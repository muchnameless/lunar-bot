'use strict';

const { Util: { escapeMarkdown, splitMessage }, MessageEmbed, DiscordAPIError } = require('discord.js');
const { EventEmitter } = require('events');
const { join, basename } = require('path');
const emojiRegex = require('emoji-regex/es2015');
const ms = require('ms');
const { sleep, trim, cleanFormattedNumber } = require('../../functions/util');
const { getAllJsFiles } = require('../../functions/files');
const { VERSION, invisibleCharacters } = require('../../constants/chatBridge');
const { unicodeToName, nameToUnicode } = require('../../constants/emojiNameUnicodeConverter');
const minecraftBot = require('./MinecraftBot');
const WebhookError = require('../errors/WebhookError');
const AsyncQueue = require('../AsyncQueue');
const MessageCollector = require('./MessageCollector');
const logger = require('../../functions/logger');

/**
 * @typedef {MessageCollector.MessageCollectorOptions} AwaitMessagesOptions
 * @property {?string[]} [errors] Stop/end reasons that cause the promise to reject
 */

/**
 * @typedef {object} ChatOptions
 * @property {?string} [prefix='']
 * @property {?number} [maxParts=10]
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
		this.ingameQueue = new AsyncQueue();
		/**
		 * async queue for discord chat
		 */
		this.discordQueue = new AsyncQueue();
		/**
		 * 100 pre 1.10.2, 256 post 1.10.2
		 * @type {number}
		 */
		this.maxMessageLength = require('minecraft-data')(VERSION).version.version > require('minecraft-data')('1.10.2').version.version
			? 256
			: 100;
		/**
		 * time to wait between ingame chat messages are sent, ('you can only send a message once every half second')
		 */
		this.ingameChatDelay = 550;
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
	 * wether the guild has the chatBridge feature enabled
	 */
	get enabled() {
		return this.guild?.chatBridgeEnabled ?? false;
	}

	/**
	 * the logging webhook's channel
	 * @type {import('../extensions/TextChannel')}
	 */
	get channel() {
		return this.client.channels.cache.get(this.webhook?.channelID) ?? null;
	}

	/**
	 * player object associated with the chatBridge's bot
	 * @type {import('../database/models/Player')}
	 */
	get player() {
		return this.bot?.player ?? null;
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
	 * @param {?number} loginDelay delay in ms
	 */
	reconnect(loginDelay = Math.min(this.loginAttempts * 5_000, 300_000)) {
		// prevent multiple reconnections
		if (this.isReconnecting) return;
		this.isReconnecting = true;

		this.disconnect();

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
		if (this.webhook) return this.ready = true;

		this.ready = false;

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
		return this.bot = await minecraftBot(this, {
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
		let paddedString = string;

		// max message length is 256 post 1.11, 100 pre 1.11
		for (let index = this.maxMessageLength - paddedString.length + 1; --index;) {
			paddedString += invisibleCharacters[Math.floor(Math.random() * invisibleCharacters.length)];
		}

		return paddedString;
	}

	/**
	 * escapes all standalone occurrences of 'ez', case-insensitive
	 * @param {string} string
	 */
	_escapeEz(string) {
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
	 * replaces names with discord renders
	 * @param {string} string
	 */
	_parseMinecraftMessageToDiscord(string) {
		return escapeMarkdown(
			cleanFormattedNumber(string)
				.replace(/(?<!<a?):(\S+):(?!\d+>)/g, (match, p1) => this.client.emojis.cache.find(e => e.name.toLowerCase() === p1.toLowerCase())?.toString() ?? nameToUnicode[match.replace(/_/g, '').toLowerCase()] ?? match) // emojis (custom and default)
				.replace(/(?<!<a?):(\S+?):(?!\d+>)/g, (match, p1) => this.client.emojis.cache.find(e => e.name.toLowerCase() === p1.toLowerCase())?.toString() ?? nameToUnicode[match.replace(/_/g, '').toLowerCase()] ?? match) // emojis (custom and default)
				.replace(/#([a-z-]+)/gi, (match, p1) => this.client.channels.cache.find(ch => ch.name === p1.toLowerCase())?.toString() ?? match) // channels
				.replace(/(?<!<)@(!|&)?(\S+)(?!\d+>)/g, (match, p1, p2) => {
					switch (p1) {
						case '!': // members/users
							return this.client.lgGuild?.members.cache.find(m => m.displayName.toLowerCase() === p2.toLowerCase())?.toString() // members
								?? this.client.users.cache.find(u => u.username.toLowerCase() === p2.toLowerCase())?.toString() // users
								?? match;

						case '&': // roles
							return this.client.lgGuild?.roles.cache.find(r => r.name.toLowerCase() === p2.toLowerCase())?.toString() // roles
								?? match;

						default: { // players, members/users, roles
							const player = this.client.players.cache.find(p => p.ign.toLowerCase() === p2.toLowerCase());

							if (player?.inDiscord) return `<@${player.discordID}>`;

							return this.client.lgGuild?.members.cache.find(m => m.displayName.toLowerCase() === p2.toLowerCase())?.toString() // members
								?? this.client.users.cache.find(u => u.username.toLowerCase() === p2.toLowerCase())?.toString() // users
								?? this.client.lgGuild?.roles.cache.find(r => r.name.toLowerCase() === p2.toLowerCase())?.toString() // roles
								?? match;
						}
					}
				}),
		);
	}

	/**
	 * forwards a discord message to ingame guild chat, prettifying discord renders
	 * @param {import('../extensions/Message')} message
	 * @param {import('../database/models/Player')} player
	 */
	async forwardDiscordMessageToHypixelGuildChat(message, player) {
		return this.gchat(
			message.content,
			{ prefix: `${player?.ign ?? this._escapeEz(message.member?.displayName ?? message.author.username)}:` },
		);
	}

	/**
	 * send a message to ingame guild chat
	 * @param {string} message
	 * @param {ChatOptions} options
	 */
	async gchat(message, { prefix = '', ...options } = {}) {
		return this.chat(message, { prefix: `/gc ${prefix}${prefix.length ? ' ' : invisibleCharacters[0]}`, ...options });
	}

	/**
	 * send a message to ingame guild chat
	 * @param {string} message
	 * @param {ChatOptions} options
	 */
	async ochat(message, { prefix = '', ...options } = {}) {
		return this.chat(message, { prefix: `/oc ${prefix}${prefix.length ? ' ' : ''}`, ...options });
	}

	/**
	 * send a message to ingame party chat
	 * @param {string} message
	 * @param {ChatOptions} options
	 */
	async pchat(message, { prefix = '', ...options } = {}) {
		return this.chat(message, { prefix: `/pc ${prefix}${prefix.length ? ' ' : ''}`, ...options });
	}

	/**
	 * checks if the message includes special characters used in certain "memes" or blocked words
	 * @param {string} string
	 */
	shouldBlock(string) {
		return /[⠁-⣿]/.test(string) // memes
			|| /\bsex\b|\bcum\b|nutted|\bpedo(?:phile)?\b|\bk+ys+\b|kil.+? yourself+\b|\bn+igger+\b/i.test(string); // blocked words
	}

	/**
	 * checks the string for any non-whitespace character
	 * @param {string} string
	 */
	includesNonWhitespace(string) {
		return /[^\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}ࠀ⭍]/u.test(string);
	}

	/**
	 * splits the message into the max ingame chat length, prefixes all parts and sends them
	 * @param {string} message
	 * @param {ChatOptions} options
	 * @returns {Promise<boolean>} success - wether all message parts were send
	 */
	async chat(message, { prefix = '', maxParts = this.client.config.getNumber('DEFAULT_MAX_PARTS') } = {}) {
		let success = true;

		const messageParts = new Set(
			this._escapeEz(this._parseDiscordMessageToMinecraft(message))
				.split('\n')
				.flatMap((part) => {
					try {
						return splitMessage(part, { char: ' ', maxLength: this.maxMessageLength - prefix.length });
					} catch { // fallback in case the splitMessage throws if it doesn't contain any ' '
						if (this.client.config.getBoolean('CHAT_LOGGING_ENABLED')) logger.warn(`[CHATBRIDGE CHAT]: trimmed '${part}'`);
						success = false;
						return trim(message, this.maxMessageLength - prefix.length);
					}
				})
				.filter((part) => {
					if (this.includesNonWhitespace(part)) { // filter out white space only parts
						if (this.shouldBlock(part)) {
							if (this.client.config.getBoolean('CHAT_LOGGING_ENABLED')) logger.warn(`[CHATBRIDGE CHAT]: blocked '${part}'`);
							return success = false;
						}
						return true;
					}

					// part consists of only whitespace characters -> ignore
					if (this.client.config.getBoolean('CHAT_LOGGING_ENABLED')) logger.warn(`[CHATBRIDGE CHAT]: ignored '${part}'`);
					return false;
				}),
		);

		let partCount = 0;

		// waits between queueing each part to not clog up the queue if someone spams
		for (const part of messageParts) {
			// prevent sending more than 'maxParts' messages
			if (++partCount > maxParts) {
				if (this.client.config.getBoolean('CHAT_LOGGING_ENABLED')) [ ...messageParts ].slice(maxParts).forEach(skippedPart => logger.warn(`[CHATBRIDGE CHAT]: skipped '${skippedPart}'`));
				return false;
			}

			await this.sendToMinecraftChat(this.hypixelSpamBypass(`${prefix}${part}`));
		}

		return success;
	}

	/**
	 * send a message to the ingame chat, without changing it, this.ingameChatDelay ms queue cooldown
	 * @param {string} message
	 */
	async sendToMinecraftChat(message) {
		await this.ingameQueue.wait();

		try {
			this.bot.chat(message);
			await sleep(this.ingameChatDelay);
		} catch (error) {
			logger.error(`[CHATBRIDGE MC CHAT]: ${error}`);
		} finally {
			this.ingameQueue.shift();
		}
	}

	/**
	 * send a message both to discord and the ingame guild chat, parsing both
	 * @param {string} message
	 * @param {object} param1
	 * @param {import('discord.js').MessageOptions} [param1.discord]
	 * @param {ChatOptions} [param1.ingame]
	 * @returns {Promise<[boolean, import('../extensions/Message')]>}
	 */
	async broadcast(message, { discord, ingame: { prefix = '', maxParts = Infinity, ...options } = {} } = {}) {
		return Promise.all([
			this.gchat(message, { prefix, maxParts, ...options }),
			(async () => {
				if (!this.enabled) return null;

				await this.discordQueue.wait();

				try {
					return await this.channel?.send(this._parseMinecraftMessageToDiscord(message), discord);
				} finally {
					this.discordQueue.shift();
				}
			})(),
		]);
	}

	/**
	 * send via the chatBridge webhook
	 * @param {import('discord.js').WebhookMessageOptions} toSend
	 * @returns {Promise<import('../extensions/Message')>}
	 */
	async sendViaWebhook(toSend) {
		if (!this.enabled) return;
		if (!toSend.content?.length) return logger.warn(`[CHATBRIDGE]: ${this.logInfo}: prevented sending empty message`);

		try {
			return await this.webhook.send(toSend);
		} catch (error) {
			logger.error(`[CHATBRIDGE WEBHOOK]: ${this.logInfo}: ${error.name}: ${error.message}`);
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
	 * sends a message to ingame chat and resolves with the first message.content within 'INGAME_RESPONSE_TIMEOUT' ms that passes the regex filter, also supports a single string as input
	 * @param {object} options
	 * @param {string} options.command can also directly be used as the only parameter
	 * @param {RegExp} [options.responseRegex] regex to use as a filter for the message collector
	 * @param {number} [options.max=1]
	 * @param {number} [options.timeout]
	 * @param {boolean} [options.rejectOnTimeout=false]
	 */
	async command({ command = arguments[0], responseRegex = /[^-\s\u{2003}\u{2800}\u{0020}\u{180E}\u{200B}]/u, max = 1, timeout = this.client.config.getNumber('INGAME_RESPONSE_TIMEOUT'), rejectOnTimeout = false }) {
		const TIMEOUT_MS = timeout * 1_000;

		try {
			const result = await Promise.all([
				this.awaitMessages(
					msg => !msg.type && responseRegex.test(msg.content),
					{
						max,
						time: TIMEOUT_MS + (this.ingameQueue.remaining * this.ingameChatDelay),
						errors: [ 'time', 'disconnect' ],
					},
				),
				this.sendToMinecraftChat(trim(`/${command}`, this.maxMessageLength - 1)),
			]);

			return result[0]
				.map(x => x.content.replace(/^-{53}}|-{53}$/g, '').trim())
				.join('\n');
		} catch (error) {
			// collector ended with reason 'time' or 'disconnect' -> collected nothing
			if (Array.isArray(error)) {
				if (rejectOnTimeout) Promise.reject(
					error.length
						? error
							.map(x => x.content.replace(/^-{53}}|-{53}$/g, '').trim())
							.join('\n')
						: `no ingame response after ${ms(TIMEOUT_MS, { long: true })}`,
				);

				return error.length
					? error
						.map(x => x.content.replace(/^-{53}}|-{53}$/g, '').trim())
						.join('\n')
					: `no ingame response after ${ms(TIMEOUT_MS, { long: true })}`;
			}

			// a different error occurred
			throw error;
		}
	}
}

module.exports = ChatBridge;
