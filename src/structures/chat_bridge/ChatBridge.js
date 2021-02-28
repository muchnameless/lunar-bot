'use strict';

const { Util, MessageEmbed, DiscordAPIError } = require('discord.js');
const { EventEmitter } = require('events');
const { join, basename } = require('path');
const emojiRegex = require('emoji-regex');
const ms = require('ms');
const { sleep, trim } = require('../../functions/util');
const { getAllJsFiles } = require('../../functions/files');
const { VERSION } = require('../../constants/chatBridge');
const { unicodeToName } = require('../../constants/emojiNameUnicodeConverter');
const MinecraftBot = require('./MinecraftBot');
const WebhookError = require('../errors/WebhookError');
const AsyncQueue = require('../AsyncQueue');
const MessageCollector = require('./MessageCollector');
const logger = require('../../functions/logger');

/**
 * @typedef {MessageCollector.MessageCollectorOptions} AwaitMessagesOptions
 * @property {?string[]} [errors] Stop/end reasons that cause the promise to reject
 */


class ChatBridge extends EventEmitter {
	/**
	 * @param {import('../LunarClient')} client
	 */
	constructor(client, mcAccount) {
		super();

		this.client = client;
		/**
		 * position in the mcAccount array
		 * @type {number}
		 */
		this.mcAccount = mcAccount;
		/**
		 * @type {?import('discord.js').Webhook}
		 */
		this.webhook = null;
		/**
		 * @type {import('../database/models/HypixelGuild')}
		 */
		this.guild = null;
		/**
		 * @type {import('./MinecraftBot').MinecraftBot}
		 */
		this.bot = null;
		/**
		 * disconnect the bot if it hasn't successfully spawned in 60 seconds
		 */
		this.abortLoginTimeout = null;
		/**
		 * scheduled reconnection
		 */
		this.reconnectTimeout = null;
		/**
		 * async queue for ingame chat messages
		 */
		this.queue = new AsyncQueue();
		/**
		 * 100 pre 1.10.2, 256 post 1.10.2
		 * @type {number}
		 */
		this.maxMessageLength = require('minecraft-data')(VERSION).version.version > require('minecraft-data')('1.10.2').version.version
			? 256
			: 100;
		/**
		 * increases each login, reset to 0 on successfull spawn
		 */
		this.loginAttempts = 0;
		/**
		 * wether the bot and webhook are both present
		 */
		this.ready = false;
		/**
		 * wether the chatBridge mc bot is currently isReconnecting (prevents executing multiple reconnections)
		 */
		this.isReconnecting = false;
		/**
		 * to prevent chatBridge from reconnecting at <MinecraftBot>.end
		 */
		this.shouldReconnect = true;

		this._loadEvents();
	}

	get logInfo() {
		return `${this.bot?.username ?? 'no bot'} | ${this.guild?.name ?? 'no guild'}`;
	}

	/**
	 * the logging webhook's channel
	 * @type {import('../extensions/TextChannel')}
	 */
	get channel() {
		return this.client.channels.cache.get(this.webhook?.channelID) ?? null;
	}

	/**
	 * create and log the bot into hypixel
	 */
	async connect() {
		if (!this.shouldReconnect) throw new Error(`[CHATBRIDGE]: unable to connect #${this.mcAccount} due to a critical error`);
		if (this.ready) return console.log(`[CHATBRIDGE]: ${this.logInfo}: already connected`);

		// reconnect the bot if it hasn't successfully spawned in 60 seconds
		this.abortLoginTimeout = setTimeout(() => {
			logger.warn('[CHATBRIDGE ABORT TIMER]: login abort triggered');
			this.reconnect(0);
		}, Math.min(++this.loginAttempts * 60_000, 300_000));

		await this._createBot();

		this.isReconnecting = false;
	}

	/**
	 * destroys the connection to the guild and reconnects the bot
	 */
	reconnect(loginDelay) {
		// prevent multiple reconnections
		if (this.isReconnecting) return;
		this.isReconnecting = true;

		this.disconnect();

		loginDelay ??= Math.min(this.loginAttempts * 5_000, 300_000);

		logger.warn(`[CHATBRIDGE RECONNECT]: attempting reconnect in ${ms(loginDelay, { long: true })}`);

		this.reconnectTimeout = setTimeout(() => {
			this.connect();
			this.reconnectTimeout = null;
		}, loginDelay);
	}

	/**
	 * links this chatBridge with the bot's guild
	 * @param {?string} guildName
	 */
	async link(guildName = null) {
		const guild = guildName
			? this.client.hypixelGuilds.cache.find(hGuild => hGuild.name === guildName)
			: this.client.hypixelGuilds.cache.find(hGuild => hGuild.players.has(this.bot.uuid.replace(/-/g, '')));

		if (!guild) {
			this.ready = false;

			throw new Error(`[CHATBRIDGE]: ${this.bot.username}: no matching guild found`);
		}

		guild.chatBridge = this;
		this.guild = guild;

		logger.debug(`[CHATBRIDGE]: ${guild.name}: linked to ${this.bot.username}`);

		await this._fetchAndCacheWebhook();

		if (!this.shouldReconnect) throw new Error(`[CHATBRIDGE]: ${this.logInfo}: critical error`);
	}

	/**
	 * unlinks the chatBridge from the linked guild
	 */
	unlink() {
		this.ready = false;
		if (this.guild) this.guild.chatBridge = null;
		this.guild = null;
	}

	/**
	 * disconnects the bot and resets the chatBridge
	 */
	disconnect() {
		this.unlink();
		clearTimeout(this.reconnectTimeout);
		clearTimeout(this.abortLoginTimeout);
		this.reconnectTimeout = null;
		this.abortLoginTimeout = null;

		try {
			this.bot?.quit();
		} catch (error) {
			logger.error('[CHATBRIDGE DISCONNECT]:', error);
		}
	}

	/**
	 * fetches the chat bridge discord webhook
	 */
	async _fetchAndCacheWebhook() {
		if (this.webhook) {
			return this.ready = true;
		} else {
			this.ready = false;
		}
		if (!this.guild) return logger.warn(`[CHATBRIDGE]: chatBridge #${this.mcAccount}: no guild to fetch webhook`);

		try {
			const channel = this.client.channels.cache.get(this.guild.chatBridgeChannelID);

			if (!channel) throw new WebhookError('unknown channel', channel, this.guild);
			if (!channel.checkBotPermissions('MANAGE_WEBHOOKS')) throw new WebhookError('missing `MANAGE_WEBHOOKS`', channel, this.guild);

			const webhooks = await channel.fetchWebhooks();

			if (!webhooks.size) throw new WebhookError('no webhooks', channel, this.guild);

			this.webhook = webhooks.first();
			this.ready = true;

			logger.debug(`[CHATBRIDGE]: ${this.guild.name}: webhook fetched and cached`);
		} catch (error) {
			if (error instanceof WebhookError) {
				this.client.log(new MessageEmbed()
					.setColor(this.client.config.get('EMBED_RED'))
					.setTitle(`${error.hypixelGuild.name} Chat Bridge`)
					.setDescription(`**Error**: ${error.message}${error.channel ? `in ${error.channel}` : ''}`)
					.setTimestamp(),
				);
				this.shouldReconnect = false;

				return this.disconnect();
			}

			logger.error(`[CHATBRIDGE]: ${this.guild.name}: error fetching webhook: ${error.name}: ${error.message}`);
		}
	}

	/**
	 * uncaches the webhook
	 */
	uncacheWebhook() {
		this.webhook = null;
		this.ready = false;
	}

	/**
	 * create bot instance, loads and binds it's events and logs it into hypixel
	 */
	async _createBot() {
		return this.bot = await MinecraftBot(this, {
			host: process.env.MINECRAFT_SERVER_HOST,
			port: Number(process.env.MINECRAFT_SERVER_PORT),
			username: process.env.MINECRAFT_USERNAME.split(' ')[this.mcAccount],
			password: process.env.MINECRAFT_PASSWORD.split(' ')[this.mcAccount],
			version: VERSION,
			auth: process.env.MINECRAFT_ACCOUNT_TYPE.split(' ')[this.mcAccount],
		});
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
	 * pads the input string with random invisible chars to bypass the hypixel spam filter
	 * @param {string} string
	 */
	hypixelSpamBypass(string) {
		const invisChars = [ '⭍', 'ࠀ' ]; // those don't render in the mc client

		// max message length is 256 post 1.11, 100 pre 1.11
		for (let index = 0; index < this.maxMessageLength - string.length; ++index) {
			string += invisChars[Math.floor(Math.random() * invisChars.length)];
		}

		return string;
	}

	/**
	 * escapes all standalone occurrences of 'ez', case-insensitive
	 * @param {string} string
	 */
	static _escapeEz(string) {
		return string.replace(/(?<=\be+)(?=z+\b)/gi, 'ࠀ');
	}

	/**
	 * replaces discord renders with names
	 * @param {string} string
	 */
	_parseDiscordMessageToMinecraft(string) {
		return string
			.replace(/<?(a)?:?(\w{2,32}):(\d{17,19})>?/g, ':$2:') // custom emojis
			.replace(emojiRegex(), match => unicodeToName[match] ?? match) // default emojis
			.replace(/<#(\d+)>/g, (match, p1) => { // channels
				const channelName = this.client.channels.cache.get(p1)?.name;
				if (channelName) return `#${channelName}`;
				return match;
			})
			.replace(/<@&(\d+)>/g, (match, p1) => { // roles
				const roleName = this.client.lgGuild?.roles.cache.get(p1)?.name;
				if (roleName) return `@${roleName}`;
				return match;
			})
			.replace(/<@!?(\d+)>/g, (match, p1) => { // users
				const displayName = this.client.lgGuild?.members.cache.get(p1)?.displayName ?? this.client.users.cache.get(p1)?.username;
				if (displayName) return `@${displayName}`;
				return match;
			});
	}

	/**
	 * forwards a discord message to ingame guild chat, prettifying discord renders
	 * @param {import('../extensions/Message')} message
	 * @param {import('../database/models/Player')} player
	 */
	async forwardDiscordMessageToHypixelGuildChat(message, player) {
		return this.gchat(
			this.constructor._escapeEz(this._parseDiscordMessageToMinecraft(message.content)),
			`${player?.ign ?? this.constructor._escapeEz(message.member?.displayName ?? message.author.username)}:`,
		);
	}

	/**
	 * send a message to ingame guild chat
	 * @param {string} message
	 * @param {?string} prefix
	 */
	async gchat(message, prefix = '') {
		return this.chat(message, `/gc ${prefix}${prefix.length ? ' ' : ''}`);
	}

	/**
	 * send a message to ingame party chat
	 * @param {string} message
	 * @param {?string} prefix
	 */
	async pchat(message, prefix = '') {
		return this.chat(message, `/pc ${prefix}${prefix.length ? ' ' : ''}`);
	}

	/**
	 * splits the message into the max ingame chat length, prefixes all parts and sends them
	 * @param {string} message
	 * @param {?string} prefix
	 */
	async chat(message, prefix = '') {
		const messageParts = message.split('\n').flatMap(part => {
			try {
				return Util.splitMessage(part, { char: ' ', maxLength: this.maxMessageLength - prefix.length });
			} catch {
				// fallback in case the splitMessage throws if it doesn't contain any ' '
				return trim(message, this.maxMessageLength - prefix.length);
			}
		});

		for (const part of messageParts) {
			await this.queueForMinecraftChat(this.hypixelSpamBypass(`${prefix}${part}`));
		}
	}

	/**
	 * send a message to the ingame chat, without changing it, 600 ms queue cooldown
	 * @param {string} message
	 */
	async queueForMinecraftChat(message) {
		await this.queue.wait();

		try {
			this.bot.chat(message);
			await sleep(600); // sends each part 600 ms apart ('you can only send a message once every half second')
		} catch (error) {
			logger.error(`[CHATBRIDGE MC CHAT]: ${error}`);
		} finally {
			this.queue.shift();
		}
	}

	/**
	 * send a message both to discord and the ingame guild chat
	 * @param {string} message
	 * @returns {Promise<[import('../extensions/Message'), void]>}
	 */
	async broadcast(message) {
		return Promise.all([
			this.channel?.send(message),
			this.gchat(message),
		]);
	}

	/**
	 * send via the chatBridge webhook
	 * @param {import('discord.js').WebhookMessageOptions} toSend
	 */
	async sendViaWebhook(toSend) {
		if (!toSend.content?.length) return logger.warn(`[CHATBRIDGE]: ${this.logInfo}: prevented sending empty message`);

		try {
			await this.webhook.send(toSend);
		} catch (error) {
			logger.error(`[CHATBRIDGE MESSAGE]: ${this.logInfo}: ${error.name}: ${error.message}`);
			if (error instanceof DiscordAPIError && error.method === 'get' && error.code === 0 && error.httpStatus === 404) {
				this.uncacheWebhook();
				this.reconnect();
			}
		}
	}

	/**
	 * collects chat messages from the bot
	 * @param {import('./MessageCollector').CollectorFilter} filter
	 * @param {import('./MessageCollector').MessageCollectorOptions} options
	 */
	createMessageCollector(filter, options = {}) {
		return new MessageCollector(this, filter, options);
	}

	/**
	 * promisified MessageCollector
	 * @param {import('./MessageCollector').CollectorFilter} filter
	 * @param {AwaitMessagesOptions} options
	 * @returns {Promise<import('./HypixelMessage')[]>}
	 */
	awaitMessages(filter, options = {}) {
		return new Promise((resolve, reject) => {
			const collector = this.createMessageCollector(filter, options);

			collector.once('end', (collection, reason) => {
				if (options.errors?.includes(reason)) {
					reject(collection);
				} else {
					resolve(collection);
				}
			});
		});
	}

	/**
	 * sends a message to ingame chat and resolves with the first message.content within 'INGAME_RESPONSE_TIMEOUT' ms that passes the regex filter
	 * @param {object} options
	 * @param {string} options.command
	 * @param {RegExp} options.responseRegex regex to use as a filter for the message collector
	 * @param {number} [options.timeout]
	 * @param {boolean} [options.rejectOnTimeout=false]
	 */
	async command({ command, responseRegex, timeout = this.client.config.getNumber('INGAME_RESPONSE_TIMEOUT'), rejectOnTimeout = false }) {
		try {
			const result = await Promise.all([
				this.awaitMessages(
					msg => responseRegex.test(msg.content),
					{
						max: 1,
						time: timeout *= 1_000,
						errors: [ 'time', 'disconnect' ],
					},
				),
				this.queueForMinecraftChat(trim(`/${command}`, this.maxMessageLength - 1)),
			]);

			return result[0][0].content;
		} catch (error) {
			// collector ended with reason 'time' -> collected nothing
			if (Array.isArray(error)) {
				if (rejectOnTimeout) throw new Error(`no ingame response after ${ms(timeout, { long: true })}`);
				return `no ingame response after ${ms(timeout, { long: true })}`;
			}

			// a different error occurred
			throw error;
		}
	}
}

module.exports = ChatBridge;
