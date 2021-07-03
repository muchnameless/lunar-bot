'use strict';

const { EventEmitter } = require('events');
const { join, basename } = require('path');
const { getAllJsFiles } = require('../../functions/files');
const { prefixByType, messageTypes: { GUILD }, chatFunctionByType, randomInvisibleCharacter } = require('./constants/chatBridge');
const MinecraftChatManager = require('./managers/MinecraftChatManager');
const logger = require('../../functions/logger');
const DiscordManager = require('./managers/DiscordManager');
const { sleep } = require('../../functions/util');


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
		this.guild = null;
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

		this._loadEvents();
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
		return `${this.bot?.username ?? 'no bot'} | ${this.guild?.name ?? 'no guild'}`;
	}

	/**
	 * wether the guild has the chatBridge feature enabled
	 */
	get enabled() {
		return this.guild?.chatBridgeEnabled ?? false;
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
	get connect() {
		return this.minecraft.connect.bind(this.minecraft);
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
		return this.minecraft.disconnect();
	}

	/**
	 * links this chatBridge with the bot's guild
	 * @param {?string} guildName
	 */
	async link(guildName = null) {
		try {
			// link bot to db entry (create if non existant)
			this.bot.player ??= await (async () => {
				/** @type {[import('../database/models/Player'), boolean]} */
				const [ player, created ] = await this.client.players.model.findOrCreate({
					where: { minecraftUUID: this.bot.uuid },
					defaults: {
						ign: this.bot.ign,
					},
				});

				if (created) this.client.players.set(player.minecraftUUID, player);

				return player;
			})();

			// guild to link to
			const guild = guildName
				? this.client.hypixelGuilds.cache.find(({ name }) => name === guildName)
				: this.client.hypixelGuilds.cache.find(({ players }) => players.has(this.bot.uuid));

			// no guild found
			if (!guild) {
				this.unlink();

				logger.error(`[CHATBRIDGE]: ${this.bot.ign}: no matching guild found`);
				return this;
			}

			// already linked to this guild
			if (guild.guildID === this.guild?.guildID) {
				logger.debug(`[CHATBRIDGE]: ${this.logInfo}: already linked`);
				return this;
			}

			guild.chatBridge = this;
			this.guild = guild;

			logger.debug(`[CHATBRIDGE]: ${guild.name}: linked to ${this.bot.ign}`);

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
		if (this.guild) this.guild.chatBridge = null;
		this.guild = null;

		// clear DiscordChatManagers
		this.discord.channelsByIDs.clear();
		this.discord.channelsByType.clear();

		return this;
	}

	/**
	 * load chatBridge events
	 */
	async _loadEvents() {
		const eventFiles = await getAllJsFiles(join(__dirname, 'events'));

		for (const file of eventFiles) {
			const event = require(file);
			const EVENT_NAME = basename(file, '.js');

			this.on(EVENT_NAME, event.bind(null, this));
		}

		logger.debug(`[CHATBRIDGE EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);
	}

	/**
	 * forwards the discord message to minecraft chat if the ChatBridge has a DiscordChatManager for the message's channel, returning true if so, false otherwise
	 * @param {import('../extensions/Message')} message
	 * @param {MessageForwardOptions} [options]
	 */
	handleDiscordMessage(message, { link = this.discord.get(message.channel.id), ...options }) {
		return (this.discord.resolve(link)?.forwardToMinecraft(message, options) && true) ?? false;
	}

	/**
	 * send a message both to discord and the ingame guild chat, parsing both
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
