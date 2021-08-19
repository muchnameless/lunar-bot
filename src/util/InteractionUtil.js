import { MessageActionRow, MessageButton, MessageEmbed, SnowflakeUtil, Constants } from 'discord.js';
import { GUILD_ID_ALL, X_EMOJI, Y_EMOJI } from '../constants/index.js';
import { MessageUtil, ChannelUtil, UserUtil } from './index.js';
import { logger, makeContent, validateDiscordId, validateMinecraftUuid } from '../functions/index.js';


/**
 * @typedef {object} InteractionData
 * @property {?Promise<void>} deferReplyPromise
 * @property {?Promise<void>} deferUpdatePromise
 * @property {boolean} useEphemeral
 */

/**
 * @typedef {import('discord.js').CommandInteraction | import('discord.js').ButtonInteraction | import('discord.js').SelectMenuInteraction} GenericInteraction
 */


export default class InteractionUtil extends null {
	/**
	 * @type {WeakMap<GenericInteraction, InteractionData>}
	 */
	static CACHE = new WeakMap();

	/**
	 * @param {GenericInteraction} interaction
	 */
	static add(interaction) {
		const { channel } = interaction;
		/** @type {InteractionData} */
		const interactionData = {
			deferReplyPromise: null,
			deferUpdatePromise: null,
			useEphemeral: this.#checkEphemeralOption(interaction)
				?? (channel !== null && channel.type !== 'DM'
					? !(channel.name.includes('command') || ChannelUtil.isTicket(channel)) // guild channel
					: false), // DM channel
		};

		this.CACHE.set(interaction, interactionData);

		return interactionData;
	}

	/**
	 * checks the command options for the ephemeral option
	 * @param {GenericInteraction} interaction
	 */
	static #checkEphemeralOption(interaction) {
		if (!interaction.isCommand()) return null;

		switch (interaction.options.getString('visibility')) {
			case 'everyone':
				return false;

			case 'just me':
				return true;

			default:
				return null;
		}
	}

	/**
	 * @param {GenericInteraction} interaction
	 */
	static logInfo(interaction) {
		if (interaction.isCommand()) {
			return [
				this.fullCommandName(interaction),
				...interaction.options._hoistedOptions.map(({ name, value }) => `${name}: ${value}`),
			].filter(x => x !== null).join(' ');
		}

		return `${interaction.componentType} ${interaction.customId}`;
	}

	/**
	 * appends the first option name if the command is a subcommand or subcommand group
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	static fullCommandName(interaction) {
		return [
			interaction.commandName,
			interaction.options.getSubcommandGroup(false),
			interaction.options.getSubcommand(false),
		].filter(x => x !== null).join(' ');
	}

	/**
	 * wether the force option was set to true
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	static checkForce(interaction) {
		return interaction.options.getBoolean('force') ?? false;
	}

	/**
	 * @param {GenericInteraction} interaction
	 * @param {import('discord.js').InteractionDeferOptions} options
	 */
	static async deferReply(interaction, options = {}) {
		const cached = this.CACHE.get(interaction);
		if (cached.deferReplyPromise) return cached.deferReplyPromise;

		return cached.deferReplyPromise = interaction.deferReply({ ephemeral: cached.useEphemeral, ...options });
	}

	/**
	 * @param {GenericInteraction} interaction
	 * @param {string | import('discord.js').InteractionReplyOptions} contentOrOptions
	 */
	static async reply(interaction, contentOrOptions) {
		const cached = this.CACHE.get(interaction);
		const data = typeof contentOrOptions === 'string'
			? { ephemeral: cached.useEphemeral, content: contentOrOptions }
			: { ephemeral: cached.useEphemeral, ...contentOrOptions };

		try {
			/**
			 * allow split option for CommandInteraction#reply
			 */
			if (data.split || data.code) {
				for (const content of makeContent(data.content ?? '', { split: data.split, code: data.code })) {
					await this.reply(interaction, { ...data, content, split: false, code: false });
				}
				return;
			}

			// await defers
			if (cached.deferReplyPromise) await cached.deferReplyPromise;
			if (cached.deferUpdatePromise) await cached.deferUpdatePromise;

			// deferred but not replied
			if (interaction.deferred && !interaction.replied) {
				// ephemeral defer
				if (interaction.ephemeral) {
					if (!data.ephemeral) await interaction.editReply('\u200b'); // ephemeral empty message

					return await interaction.followUp(data);
				}

				// non-ephemeral defer
				if (data.ephemeral) await interaction.deleteReply();

				return await interaction.followUp(data);
			}

			// replied
			if (interaction.replied) return await interaction.followUp(data);

			// initial reply
			return await interaction.reply(data);
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * @param {GenericInteraction} interaction
	 * @param {string | import('discord.js').WebhookEditMessageOptions} contentOrOptions
	 */
	static async editReply(interaction, contentOrOptions) {
		const { deferReplyPromise, deferUpdatePromise } = this.CACHE.get(interaction);

		try {
			if (deferReplyPromise) await deferReplyPromise;
			if (deferUpdatePromise) await deferUpdatePromise;

			return await interaction.editReply(contentOrOptions);
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * @param {import('discord.js').MessageComponentInteraction} interaction
	 * @param {import('discord.js').InteractionDeferUpdateOptions} options
	 */
	static async deferUpdate(interaction, options) {
		const cached = this.CACHE.get(interaction);
		if (cached.deferUpdatePromise) return cached.deferUpdatePromise;

		return cached.deferUpdatePromise = interaction.deferUpdate(options);
	}

	/**
	 * @param {import('discord.js').MessageComponentInteraction} interaction
	 * @param {import('discord.js').InteractionUpdateOptions} options
	 */
	static async update(interaction, options) {
		const { deferUpdatePromise } = this.CACHE.get(interaction);

		try {
			// await defer
			if (deferUpdatePromise) await deferUpdatePromise;

			// deferred but not replied
			if (interaction.deferred && !interaction.replied) return await interaction.editReply(options);

			// replied
			if (interaction.replied) return await interaction.message.edit(options);

			// initial reply
			return await interaction.update(options);
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param {GenericInteraction} interaction
	 * @param {import('discord.js').InteractionReplyOptions & { question: string, timeoutSeconds: number }} questionOrOptions
	 */
	static async awaitReply(interaction, questionOrOptions) {
		const { question = 'confirm this action?', timeoutSeconds = 60, ...options } = typeof questionOrOptions === 'string'
			? { question: questionOrOptions }
			: questionOrOptions;

		try {
			/** @type {import('discord.js').TextBasedChannels} */
			const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);

			await this.reply(interaction, {
				content: question,
				...options,
			});

			const collected = await channel.awaitMessages({
				filter: msg => msg.author.id === interaction.user.id,
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
	 * @param {GenericInteraction} interaction
	 * @param {import('discord.js').InteractionReplyOptions & { question: string, timeoutSeconds: number, errorMessage: string }} [questionOrOptions={}]
	 */
	static async awaitConfirmation(interaction, questionOrOptions = {}) {
		const { question = 'confirm this action?', timeoutSeconds = 60, errorMessage = 'the command has been cancelled', ...options } = typeof questionOrOptions === 'string'
			? { question: questionOrOptions }
			: questionOrOptions;

		try {
			/** @type {import('discord.js').TextBasedChannels} */
			const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);
			const SUCCESS_ID = `confirm:${SnowflakeUtil.generate()}`;
			const CANCLE_ID = `confirm:${SnowflakeUtil.generate()}`;

			await this.reply(interaction, {
				embeds: [
					interaction.client.defaultEmbed
						.setDescription(question),
				],
				components: [
					new MessageActionRow()
						.addComponents(
							new MessageButton()
								.setCustomId(SUCCESS_ID)
								.setStyle(Constants.MessageButtonStyles.SUCCESS)
								.setEmoji(Y_EMOJI),
							new MessageButton()
								.setCustomId(CANCLE_ID)
								.setStyle(Constants.MessageButtonStyles.DANGER)
								.setEmoji(X_EMOJI),
						),
				],
				...options,
			});

			const result = await channel.awaitMessageComponent({
				componentType: Constants.MessageComponentTypes.BUTTON,
				filter: i => (i.user.id === interaction.user.id && [ SUCCESS_ID, CANCLE_ID ].includes(i.customId)
					? true
					: (async () => {
						try {
							await this.reply(interaction, {
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

			const success = result.customId === SUCCESS_ID;

			this.update(result, {
				embeds: [
					new MessageEmbed()
						.setColor(interaction.client.config.get(success ? 'EMBED_GREEN' : 'EMBED_RED'))
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
	 * @param {GenericInteraction} interaction
	 * @param {import('discord.js').EmojiIdentifierResolvable[]} emojis
	 */
	static async react(interaction, ...emojis) {
		if (interaction.ephemeral) return null;

		try {
			return await MessageUtil.react(await interaction.fetchReply(), ...emojis);
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * returns the player object, optional fallback to the interaction.user's player
	 * @param {import('discord.js').CommandInteraction} interaction
	 * @param {boolean} [fallbackToCurrentUser=false]
	 * @returns {?import('../structures/database/models/Player').Player}
	 */
	static getPlayer(interaction, fallbackToCurrentUser = false) {
		if (!interaction.options._hoistedOptions.length) {
			if (fallbackToCurrentUser) return UserUtil.getPlayer(interaction.user);
			return null;
		}

		const INPUT = (interaction.options.getString('player') ?? interaction.options.getString('target'))?.replace(/\W/g, '').toLowerCase();

		if (!INPUT) {
			if (fallbackToCurrentUser) return UserUtil.getPlayer(interaction.user);
			return null;
		}

		if (validateDiscordId(INPUT)) return interaction.client.players.getById(INPUT);
		if (validateMinecraftUuid(INPUT)) return interaction.client.players.get(INPUT);

		return (this.checkForce(interaction)
			? interaction.client.players.cache.find(({ ign }) => ign.toLowerCase() === INPUT)
			: interaction.client.players.getByIgn(INPUT))
			?? null;
	}

	/**
	 * returns the player object's IGN, optional fallback to interaction.user's player
	 * @param {import('discord.js').CommandInteraction} interaction
	 * @param {boolean} [fallbackToCurrentUser=false]
	 * @returns {?string}
	 */
	static getIgn(interaction, fallbackToCurrentUser = false) {
		if (this.checkForce(interaction)) return (interaction.options.getString('player') ?? interaction.options.getString('target'))?.toLowerCase();
		return this.getPlayer(interaction, fallbackToCurrentUser)?.ign ?? null;
	}

	/**
	 * returns a HypixelGuild instance
	 * @param {import('discord.js').CommandInteraction} interaction
	 * @returns {import('../structures/database/models/HypixelGuild').HypixelGuild | GUILD_ID_ALL}
	 */
	static getHypixelGuild(interaction) {
		const INPUT = interaction.options.getString('guild');
		if (INPUT === GUILD_ID_ALL) return INPUT;
		return interaction.client.hypixelGuilds.cache.get(INPUT) ?? UserUtil.getPlayer(interaction.user)?.hypixelGuild ?? interaction.client.hypixelGuilds.mainGuild;
	}
}
