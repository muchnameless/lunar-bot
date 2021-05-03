'use strict';

const { EventEmitter } = require('events');
const { join, basename } = require('path');
const ms = require('ms');
const { getAllJsFiles } = require('../../functions/files');
const { X_EMOJI, MUTED } = require('../../constants/emojiCharacters');
const { prefixByType, messageTypes: { GUILD }, blockedWordsRegExp } = require('./constants/chatBridge');
const MinecraftChatManager = require('./managers/MinecraftChatManager');
const logger = require('../../functions/logger');
const DiscordManager = require('./managers/DiscordManager');
const { sleep } = require('../../functions/util');

/**
 * @typedef {MessageCollector.MessageCollectorOptions} AwaitMessagesOptions
 * @property {?string[]} [errors] Stop/end reasons that cause the promise to reject
 */

/**
 * @typedef {object} ChatOptions
 * @property {?string} [prefix='']
 * @property {?number} [maxParts=10]
 * @property {import('../extensions/Message')} [discordMessage]
 */

/**
 * @typedef {import('discord.js').MessageOptions} DiscordMessageOptions
 * @property {string} [prefix]
 */

/**
 * @typedef {object} MessageForwardOptions
 * @property {boolean} [options.checkifNotFromBot=true] wether to not forward messages from the client.user
 * @property {import('../database/models/Player')} [player=message.author.player] player for muted and isStaff check
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
			logger.error(`[CHATBRIDGE LINK]: #${this.mcAccount}: ${error}`);

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
	 * forwards a discord message to ingame guild chat, prettifying discord renders, if neither the player nor the whole guild chat is muted
	 * @param {import('../extensions/Message')} message
	 * @param {MessageForwardOptions} [options={}]
	 */
	// eslint-disable-next-line no-undef
	async forwardDiscordToMinecraft(message, { player = message.author.player, checkifNotFromBot = true } = {}) {
		if (!this.minecraft.ready) return message.reactSafely(X_EMOJI);

		if (!this.enabled) return;

		const discordChatManager = this.discord.get(message.channel.id);

		if (!discordChatManager) return message.reactSafely(X_EMOJI);

		if (checkifNotFromBot) {
			if (message.me) return;
			if (message.webhookID === discordChatManager.webhook?.id) return;
		}

		// check if player is muted
		if (player?.muted) {
			if (!message.me) message.author.send(`you are currently muted for ${ms(player.chatBridgeMutedUntil - Date.now(), { long: true })}`).then(
				() => logger.info(`[FORWARD DC TO MC]: ${player.logInfo}: DMed muted user`),
				error => logger.error(`[FORWARD DC TO MC]: ${player.logInfo}: error DMing muted user: ${error}`),
			);

			return message.reactSafely(MUTED);
		}

		// check if guild chat is muted
		if (this.guild.muted && !player?.isStaff) {
			if (!message.me) message.author.send(`${this.guild.name}'s guild chat is currently muted for ${ms(this.guild.chatMutedUntil - Date.now(), { long: true })}`).then(
				() => logger.info(`[FORWARD DC TO MC]: ${player?.logInfo ?? message.author.tag}: DMed guild chat muted`),
				error => logger.error(`[FORWARD DC TO MC]: ${player?.logInfo ?? message.author.tag}: error DMing guild chat muted: ${error}`),
			);

			return message.reactSafely(MUTED);
		}

		// check if the chatBridge bot is muted
		if (this.bot.player?.muted) {
			if (!message.me) message.author.send(`the bot is currently muted for ${ms(this.bot.player?.chatBridgeMutedUntil - Date.now(), { long: true })}`).then(
				() => logger.info(`[FORWARD DC TO MC]: ${player?.logInfo}: DMed bot muted`),
				error => logger.error(`[FORWARD DC TO MC]: ${player?.logInfo}: error DMing bot muted: ${error}`),
			);

			return message.reactSafely(MUTED);
		}

		return this.minecraft.chat(
			[
				message.reference // @referencedMessageAuthor
					? await (async () => {
						try {
							const referencedMessage = await message.channel.messages.fetch(message.reference?.messageID);
							return `@${ChatBridge.getPlayerName(referencedMessage)}`;
						} catch (error) {
							logger.error(`[FORWARD DC TO MC]: error fetching reference: ${error}`);
							return null;
						}
					})()
					: null,
				message.content, // actual content
				...message.attachments.map(({ url }) => url), // links of attachments
			].filter(Boolean).join(' '),
			{
				prefix: `${prefixByType[discordChatManager.type]} ${ChatBridge.getPlayerName(message)}: `,
				message,
			},
		);
	}

	/**
	 * send a message both to discord and the ingame guild chat, parsing both
	 * @param {string} message
	 * @param {object} param1
	 * @param {string|import('./managers/DiscordChatManager')} [param1.type]
	 * @param {DiscordMessageOptions} [param1.discord]
	 * @param {ChatOptions} [param1.minecraft]
	 * @returns {Promise<[boolean, ?import('../extensions/Message')|import('../extensions/Message')[]]>}
	 */
	async broadcast(message, { type = GUILD, discord: { prefix: discordPrefix = '', ...discord } = {}, minecraft: { prefix: minecraftPrefix = '', maxParts = Infinity, ...options } = {} } = {}) {
		const discordChatManager = this.discord.resolve(type);

		return Promise.all([
			this.minecraft.chat(message, { prefix: `${prefixByType[discordChatManager?.type ?? type]} ${minecraftPrefix}${minecraftPrefix.length ? ' ' : ''}`, maxParts, ...options }),
			discordChatManager?.sendViaBot(`${discordPrefix}${message}`, discord),
		]);
	}

	/**
	 * player ign or member displayName or author username, ez escaped and *blocked* if blockedWordsRegExp check doesn't pass
	 * @param {import('../extensions/Message')} message
	 */
	static getPlayerName(message) {
		const name = message.author.player?.ign ?? MinecraftChatManager.escapeEz(message.member?.displayName ?? message.author.username);

		return blockedWordsRegExp.test(name)
			? '*blocked*'
			: name;
	}
};
