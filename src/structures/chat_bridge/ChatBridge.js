'use strict';

const { EventEmitter } = require('events');
const { join } = require('path');
const { prefixByType, messageTypes: { GUILD }, chatFunctionByType, randomInvisibleCharacter } = require('./constants/chatBridge');
const { sleep } = require('../../functions/util');
const MinecraftChatManager = require('./managers/MinecraftChatManager');
const DiscordManager = require('./managers/DiscordManager');
const EventCollection = require('../events/EventCollection');
const logger = require('../../functions/logger');


/**
 * @typedef {object} ChatOptions
 * @property {string} content
 * @property {string} [prefix='']
 * @property {number} [maxParts=10]
 * @property {import('../extensions/Message')} [discordMessage]
 */

/**
 * @typedef {object} BroadcastOptions
 * @property {string | import('./managers/DiscordChatManager')} type
 * @property {import('./HypixelMessage')} hypixelMessage
 * @property {DiscordMessageOptions} discord
 * @property {ChatOptions} minecraft
 */

/**
 * @typedef {import('discord.js').MessageOptions & { prefix: string }} DiscordMessageOptions
 */

/**
 * @typedef {object} MessageForwardOptions
 * @property {import('../database/models/Player')} [player=message.author.player] player for muted and isStaff check
 * @property {import('../extensions/CommandInteraction')} [interaction]
 * @property {boolean} [checkIfNotFromBot=true] wether to not forward messages from the client.user
 * @property {boolean} [isEdit=false] wether the message is an edit instead of a new message
 */


module.exports = class ChatBridge extends EventEmitter {
	/**
	 * @param {import('../LunarClient')} client
	 */
	constructor(client, mcAccount) {
		super();

		/**
		 * client that instantiated the chat bridge
		 */
		this.client = client;
		/**
		 * position in the mcAccount array
		 * @type {number}
		 */
		this.mcAccount = mcAccount;
		/**
		 * @type {import('../database/models/HypixelGuild')}
		 */
		this.hypixelGuild = null;
		/**
		 * increases each link cycle
		 */
		this._guildLinkAttempts = 0;
		/**
		 * wether to retry linking the chat bridge to a guild
		 */
		this.shouldRetryLinking = true;
		/**
		 * timestamp of the end of the current poll, if existing
		 * @type {?number}
		 */
		this.pollUntil = null;
		/**
		 * minecraft related functions
		 */
		this.minecraft = new MinecraftChatManager(this);
		/**
		 * discord related functions
		 */
		this.discord = new DiscordManager(this);

		this.events = new EventCollection(this, join(__dirname, 'events'));

		this.events.loadAll();
	}

	/**
	 * wether the minecraft bot and all discord channel managers (webhooks) are ready
	 */
	get ready() {
		return this.minecraft.ready && this.discord.ready;
	}

	/**
	 * bot ign | guild name
	 */
	get logInfo() {
		return `${this.bot?.username ?? 'no bot'} | ${this.hypixelGuild?.name ?? 'no guild'}`;
	}

	/**
	 * wether the guild has the chatBridge feature enabled
	 */
	get enabled() {
		return this.hypixelGuild?.chatBridgeEnabled ?? false;
	}

	/**
	 * player object associated with the chatBridge's bot
	 * @type {import('../database/models/Player')}
	 */
	get player() {
		return this.bot?.player ?? null;
	}

	/**
	 * minecraft bot
	 */
	get bot() {
		return this.minecraft.bot;
	}

	/**
	 * create and log the bot into hypixel
	 * @type {Function}
	 */
	async connect() {
		await this.minecraft.connect();
		return this;
	}

	/**
	 * destroys the connection to the guild and reconnects the bot
	 * @type {Function}
	 */
	get reconnect() {
		return this.minecraft.reconnect.bind(this.minecraft);
	}

	/**
	 * disconnects the bot and resets the chatBridge
	 * @type {Function}
	 */
	disconnect() {
		this.unlink();
		this.minecraft.disconnect();
		return this;
	}

	/**
	 * links this chatBridge with the bot's guild
	 * @param {?string} guildName
	 * @returns {Promise<this>}
	 */
	async link(guildName = null) {
		try {
			// link bot to db entry (create if non existant)
			this.minecraft.botPlayer ??= await (async () => {
				/** @type {[import('../database/models/Player'), boolean]} */
				const [ player, created ] = await this.client.players.model.findOrCreate({
					where: { minecraftUuid: this.minecraft.botUuid },
					defaults: {
						ign: this.bot.username,
					},
				});

				if (created) this.client.players.set(player.minecraftUuid, player);

				return player;
			})();

			// guild to link to
			const hypixelGuild = guildName
				? this.client.hypixelGuilds.cache.find(({ name }) => name === guildName)
				: this.client.hypixelGuilds.cache.find(({ players }) => players.has(this.minecraft.botUuid));

			// no guild found
			if (!hypixelGuild) {
				this.unlink();

				logger.error(`[CHATBRIDGE]: ${this.bot.username}: no matching guild found`);
				return this;
			}

			// already linked to this guild
			if (hypixelGuild.guildId === this.hypixelGuild?.guildId) {
				logger.debug(`[CHATBRIDGE]: ${this.logInfo}: already linked`);
				return this;
			}

			hypixelGuild.chatBridge = this;
			this.hypixelGuild = hypixelGuild;

			logger.debug(`[CHATBRIDGE]: ${hypixelGuild.name}: linked to ${this.bot.username}`);

			// instantiate DiscordChannelManagers
			await this.discord.init();

			this._guildLinkAttempts = 0;

			return this;
		} catch (error) {
			logger.error(`[CHATBRIDGE LINK]: #${this.mcAccount}`, error);

			if (!this.shouldRetryLinking) {
				logger.error(`[CHATBRIDGE LINK]: #${this.mcAccount}: aborting retry due to a critical error`);
				return this;
			}

			await sleep(Math.min(++this._guildLinkAttempts * 5_000, 300_000));

			return this.link(guildName);
		}
	}

	/**
	 * unlinks the chatBridge from the linked guild
	 */
	unlink() {
		this.discord.ready = false;
		if (this.hypixelGuild) this.hypixelGuild.chatBridge = null;
		this.hypixelGuild = null;

		// clear DiscordChatManagers
		// this.discord.channelsByIds.clear();
		// this.discord.channelsByType.clear();

		return this;
	}

	/**
	 * Increments max listeners by one, if they are not zero.
	 */
	incrementMaxListeners() {
		const maxListeners = this.getMaxListeners();

		if (maxListeners !== 0) this.setMaxListeners(maxListeners + 1);
	}

	/**
	 * Decrements max listeners by one, if they are not zero.
	 */
	decrementMaxListeners() {
		const maxListeners = this.getMaxListeners();

		if (maxListeners !== 0) this.setMaxListeners(maxListeners - 1);
	}

	/**
	 * forwards the discord message to minecraft chat if the ChatBridge has a DiscordChatManager for the message's channel, returning true if so, false otherwise
	 * @param {import('../extensions/Message')} message
	 * @param {MessageForwardOptions} [options]
	 */
	handleDiscordMessage(message, { link = this.discord.get(message.channelId), ...options }) {
		return (this.discord.resolve(link)?.forwardToMinecraft(message, options) && true) ?? false;
	}

	/**
	 * send a message both to discord and the in game guild chat, parsing both
	 * @param {string | BroadcastOptions} contentOrOptions
	 * @returns {Promise<[boolean, ?import('../extensions/Message')|import('../extensions/Message')[]]>}
	 */
	async broadcast(contentOrOptions) {
		const { content, hypixelMessage, type = hypixelMessage?.type ?? GUILD, discord = {}, minecraft: { prefix: minecraftPrefix = '', maxParts = Infinity, ...options } = {} } = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;
		const discordChatManager = this.discord.resolve(type);

		return Promise.all([
			// minecraft
			this.minecraft[chatFunctionByType[(discordChatManager?.type ?? type)]]?.({ content, prefix: minecraftPrefix, maxParts, ...options })
				?? this.minecraft.chat({
					content,
					prefix: `${discordChatManager?.prefix ?? prefixByType[(discordChatManager?.type ?? type)]} ${minecraftPrefix}${minecraftPrefix.length ? ' ' : randomInvisibleCharacter()}`,
					maxParts,
					...options,
				}),

			// discord
			discordChatManager?.sendViaBot({
				content,
				hypixelMessage,
				...discord,
			}),
		]);
	}
};
