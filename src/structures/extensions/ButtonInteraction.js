'use strict';

const { Structures, Permissions, MessageActionRow, MessageButton, MessageEmbed, SnowflakeUtil, Constants } = require('discord.js');
const { Y_EMOJI, X_EMOJI } = require('../../constants/emojiCharacters');
const { makeContent } = require('../../functions/util');
const logger = require('../../functions/logger');


class LunarButtonInteraction extends Structures.get('ButtonInteraction') {
	constructor(...args) {
		super(...args);

		/**
		 * deferring promise
		 */
		this._deferring = null;
		/**
		 * deferring update promise
		 */
		this._deferringUpdate = null;

		const { channel } = this;

		/**
		 * wether to use ephemeral replies and deferring
		 */
		this.useEphemeral = channel !== null && channel.type !== 'dm'
			? !(channel.name.includes('command') || channel.isTicket) // guild channel
			: false; // DM channel
	}

	/**
	 * the user who started the interaction (for compatibility with message methods)
	 */
	get author() {
		return this.user;
	}

	/**
	 * @param {import('discord.js').InteractionDeferOptions} param0
	 */
	async defer({ ephemeral = this.useEphemeral, ...options } = {}) {
		if (this._deferring) return this._deferring;

		return this._deferring = super.defer({ ephemeral, ...options });
	}

	async deferUpdate() {
		if (this._deferringUpdate) return this._deferringUpdate;

		return this._deferringUpdate = super.deferUpdate();
	}

	async update(options) {
		await this._deferringUpdate;

		return super.update(options);
	}

	/**
	 * replies to the interaction, ephemeral if not in an #bot-commands channel and no ephemeral option set
	 * @param {string | import('discord.js').InteractionReplyOptions} contentOrOptions
	 */
	async reply(contentOrOptions) {
		const data = typeof contentOrOptions === 'string'
			? { ephemeral: this.useEphemeral, content: contentOrOptions }
			: { ephemeral: this.useEphemeral, ...contentOrOptions };

		/**
		 * allow split option for CommandInteraction#reply
		 */
		if (data.split || data.code) {
			for (const content of makeContent(data.content ?? '', { split: data.split, code: data.code })) {
				await this.reply({ ...data, content, split: false, code: false });
			}
			return;
		}

		await this._deferring;

		if (this.deferred && !this.replied) {
			// ephemeral defer
			if (this.ephemeral) {
				if (data.ephemeral) {
					const message = await this.editReply(data);
					return this._handleReplyMessage(data, message);
				}

				// ephemeral defer and non-ephemeral followUp
				await this.deleteReply();
				const message = await this.followUp(data);
				return this._handleReplyMessage(data, message);
			}

			// non-ephemeral defer
			if (data.ephemeral) {
				await this.deleteReply();
				const message = await this.followUp(data);
				return this._handleReplyMessage(data, message);
			}

			const mesage = await this.editReply(data);
			return this._handleReplyMessage(data, mesage);
		}

		if (this.replied) {
			const message = await this.followUp(data);
			return this._handleReplyMessage(data, message);
		}

		const message = await super.reply(data);
		return this._handleReplyMessage(data, message);
	}

	/**
	 * forwards non-ephemeral replies to the chat bridges
	 * @param {import('discord.js').InteractionReplyOptions} param0
	 * @param {import('./Message')} [messageInput]
	 */
	async _handleReplyMessage({ ephemeral, content }, messageInput) {
		if (ephemeral || !content || this.client.chatBridges.channelIDs.has(this.channelID)) return;

		const message = messageInput ?? await this.fetchReply();

		this.client.chatBridges.handleDiscordMessage(
			message,
			{
				player: this.user.player,
				interaction: this,
				checkIfNotFromBot: false,
			},
		);
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param {import('discord.js').InteractionReplyOptions & { question: string, timeoutSeconds: number }} questionOrOptions
	 */
	async awaitReply(questionOrOptions) {
		const { question = 'confirm this action?', timeoutSeconds = 60, ...options } = typeof questionOrOptions === 'string'
			? { question: questionOrOptions }
			: questionOrOptions;

		try {
			await this.reply({
				content: question,
				...options,
			});

			const collected = await this.channel.awaitMessages({
				filter: msg => msg.author.id === this.user.id,
				max: 1,
				time: timeoutSeconds * 1_000,
				errors: [ 'time' ],
			});

			return collected.first().content;
		} catch {
			return null;
		}
	}

	/**
	 * confirms the action via a button collector
	 * @param {import('discord.js').InteractionReplyOptions & { question: string, timeoutSeconds: number, errorMessage: string }} [questionOrOptions]
	 */
	async awaitConfirmation(questionOrOptions = {}) {
		const { question = 'confirm this action?', timeoutSeconds = 60, errorMessage = 'the command has been cancelled', ...options } = typeof questionOrOptions === 'string'
			? { question: questionOrOptions }
			: questionOrOptions;

		try {
			if (!this.channel) await this.client.channels.fetch(this.channelID);

			const SUCCESS_ID = `confirm:${SnowflakeUtil.generate()}`;
			const CANCLE_ID = `confirm:${SnowflakeUtil.generate()}`;

			await this.reply({
				embeds: [
					this.client.defaultEmbed
						.setDescription(question),
				],
				components: [
					new MessageActionRow()
						.addComponents(
							new MessageButton()
								.setCustomID(SUCCESS_ID)
								.setStyle(Constants.MessageButtonStyles.SUCCESS)
								.setEmoji(Y_EMOJI),
							new MessageButton()
								.setCustomID(CANCLE_ID)
								.setStyle(Constants.MessageButtonStyles.DANGER)
								.setEmoji(X_EMOJI),
						),
				],
				...options,
			});

			const result = await this.channel.awaitMessageComponentInteraction({
				filter: interaction => (interaction.user.id === this.user.id && [ SUCCESS_ID, CANCLE_ID ].includes(interaction.customID)
					? true
					: (async () => {
						try {
							await interaction.reply({
								content: 'that is not up to you to decide',
								ephemeral: true,
							});
						} catch (error) {
							logger.error(error);
						}
						return false;
					})()),
				time: timeoutSeconds * 1_000,
			});

			const success = result.customID === SUCCESS_ID;

			result.update({
				embeds: [
					new MessageEmbed()
						.setColor(this.client.config.get(success ? 'EMBED_GREEN' : 'EMBED_RED'))
						.setDescription(success ? 'confirmed' : 'cancelled')
						.setTimestamp(),
				],
				components: [],
			});

			if (!success) throw errorMessage;
		} catch (error) {
			logger.debug(error);
			throw errorMessage;
		}
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param {import('discord.js').EmojiIdentifierResolvable[]} emojis
	 * @returns {Promise<?import('discord.js').MessageReaction[]>}
	 */
	async react(...emojis) {
		if (this.ephemeral) return null;
		if (!this.channel?.botPermissions.has(Permissions.FLAGS.ADD_REACTIONS)) return logger.error(`[INTERACTION REACT]: missing 'ADD_REACTIONS' in ${this.channel ?? this.channelID}`);

		try {
			return await this.message.react(...emojis);
		} catch (error) {
			return logger.error('[INTERACTION REACT]', error);
		}
	}
}

Structures.extend('ButtonInteraction', () => LunarButtonInteraction);

module.exports = LunarButtonInteraction;
