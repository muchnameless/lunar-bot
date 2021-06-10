'use strict';

const { basename } = require('path');
const { Structures, ButtonInteraction, Permissions, APIMessage } = require('discord.js');
const logger = require('../../functions/logger');


class LunarButtonInteraction extends ButtonInteraction {
	constructor(...args) {
		super(...args);

		/**
		 * wether the first reply was ephemeral
		 */
		this.ephemeral = null;
		/**
		 * deferring promise
		 */
		this._deferring = null;

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
		this.ephemeral = ephemeral;

		return this._deferring = super.defer({ ephemeral, ...options });
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
		if (data.split) {
			for (const content of APIMessage.create(this, data).makeContent()) {
				await this.reply({ ...data, content, split: false, code: false });
			}
			return;
		}

		await this._deferring;

		if (this.deferred) {
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

		this.ephemeral = data.ephemeral;

		await super.reply(data);
		return this._handleReplyMessage(data);
	}

	/**
	 * forwards non-ephemeral replies to the chat bridges
	 * @param {import('discord.js').InteractionReplyOptions} param0
	 * @param {import('./Message')} [messageInput]
	 */
	async _handleReplyMessage({ ephemeral, content }, messageInput) {
		if (ephemeral || !content || this.client.chatBridges.channelIDs.has(this.channelID)) return;

		const message = messageInput ?? await this.fetchReply();

		this.client.chatBridges.handleDiscordMessage(message, { checkIfNotFromBot: false });
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param {string} question the question to ask the message author
	 * @param {number} timeoutSeconds secods before the question timeouts
	 */
	async awaitReply(question, timeoutSeconds = 60) {
		try {
			await this.reply(question);

			const collected = await this.channel.awaitMessages(
				msg => msg.author.id === this.user.id,
				{ max: 1, time: timeoutSeconds * 1_000, errors: [ 'time' ] },
			);

			return collected.first().content;
		} catch {
			return null;
		}
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param {import('discord.js').EmojiIdentifierResolvable[]} emojis
	 * @returns {Promise<?import('discord.js').MessageReaction[]>}
	 */
	async react(...emojis) {
		if (this.ephemeral) return null;
		if (!this.channel?.botPermissions.has(Permissions.FLAGS.ADD_REACTIONS)) return null;

		try {
			return await this.message.react(...emojis);
		} catch (error) {
			return logger.error('[MESSAGE REACT]', error);
		}
	}
}

Structures.extend(basename(__filename, '.js'), () => LunarButtonInteraction);

module.exports = LunarButtonInteraction;
