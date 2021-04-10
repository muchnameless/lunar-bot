'use strict';

const { Util: { escapeMarkdown, splitMessage }, MessageEmbed, DiscordAPIError } = require('discord.js');
const { EventEmitter } = require('events');
const { join, basename } = require('path');
const emojiRegex = require('emoji-regex/es2015')();
const ms = require('ms');
const { sleep, trim, cleanFormattedNumber } = require('../../functions/util');
const { getAllJsFiles } = require('../../functions/files');
const { MC_CLIENT_VERSION } = require('./constants/settings');
const { defaultResponseRegExp, memeRegExp, blockedWordsRegExp, nonWhiteSpaceRegExp, randomInvisibleCharacter, messageTypes: { GUILD, PARTY, OFFICER } } = require('./constants/chatBridge');
const { unicodeToName, nameToUnicode } = require('./constants/emojiNameUnicodeConverter');
const { spamMessages } = require('./constants/commandResponses');
const { STOP, X_EMOJI } = require('../../constants/emojiCharacters');
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
 * @property {import('../extensions/Message')} [discordMessage]
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
		this.maxMessageLength = require('minecraft-data')(MC_CLIENT_VERSION).version.version > require('minecraft-data')('1.10.2').version.version
			? 256
			: 100;
		/**
		 * increases each login, reset to 0 on successfull spawn
		 */
		this.loginAttempts = 0;
		/**
		 * timestamp of the end of the current poll, if existing
		 * @type {?number}
		 */
		this.pollUntil = null;
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
		/**
		 * in game chat related information
		 */
		this.ingameChat = {
			/**
			 * message that is currently being forwarded to in game chat
			 * @type {?import('../extensions/Message')}
			 */
			discordMessage: null,
			/**
			 * current retry when resending messages
			 */
			retries: 0,
			/**
			 * maximum attempts to resend to in game chat
			 */
			maxRetries: 3,
			/**
			 * normal delay to listen for error messages
			 */
			delays: [
				null,
				100,
				100,
				100,
				120,
				150,
				600,
			],
			/**
			 * increased delay which can be used to send messages to in game chat continously
			 */
			safeDelay: 600,
			/**
			 * how many messages have been sent to in game chat in the last 10 seconds
			 */
			messageCounter: 0,
			/**
			 * increments messageCounter for 10 seconds
			 */
			tempIncrementCounter() {
				setTimeout(() => --this.messageCounter, 10_000);
				return ++this.messageCounter;
			},
			/**
			 * increasing delay
			 */
			get delay() {
				return this.delays[this.tempIncrementCounter()] ?? this.safeDelay;
			},
		};

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
		if (this.ready) {
			logger.info(`[CHATBRIDGE]: ${this.logInfo}: already connected`);
			return this;
		}

		// reconnect the bot if it hasn't successfully spawned in 60 seconds
		this.abortLoginTimeout = setTimeout(() => {
			logger.warn('[CHATBRIDGE ABORT TIMER]: login abort triggered');
			this.reconnect(0);
		}, Math.min(++this.loginAttempts * 60_000, 300_000));

		await this._createBot();

		this.isReconnecting = false;

		return this;
	}

	/**
	 * destroys the connection to the guild and reconnects the bot
	 * @param {?number} loginDelay delay in ms
	 */
	reconnect(loginDelay = Math.min(this.loginAttempts * 5_000, 300_000)) {
		// prevent multiple reconnections
		if (this.isReconnecting) return this;
		this.isReconnecting = true;

		this.disconnect();

		logger.warn(`[CHATBRIDGE RECONNECT]: attempting reconnect in ${ms(loginDelay, { long: true })}`);

		this.reconnectTimeout = setTimeout(() => {
			this.connect();
			this.reconnectTimeout = null;
		}, loginDelay);

		return this;
	}

	/**
	 * links this chatBridge with the bot's guild
	 * @param {?string} guildName
	 */
	async link(guildName = null) {
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

		const guild = guildName
			? this.client.hypixelGuilds.cache.find(({ name }) => name === guildName)
			: this.client.hypixelGuilds.cache.find(({ players }) => players.has(this.bot.uuid));

		if (!guild) {
			this.ready = false;

			throw new Error(`[CHATBRIDGE]: ${this.bot.ign}: no matching guild found`);
		}

		guild.chatBridge = this;
		this.guild = guild;

		logger.debug(`[CHATBRIDGE]: ${guild.name}: linked to ${this.bot.ign}`);

		await this._fetchAndCacheWebhook();

		if (!this.shouldReconnect) throw new Error(`[CHATBRIDGE]: ${this.logInfo}: critical error`);

		return this;
	}

	/**
	 * unlinks the chatBridge from the linked guild
	 */
	unlink() {
		this.ready = false;
		if (this.guild) this.guild.chatBridge = null;
		this.guild = null;

		return this;
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

		return this;
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

			logger.error(`[CHATBRIDGE]: ${this.guild.name}: error fetching webhook: ${error}`);
		}
	}

	/**
	 * uncaches the webhook
	 */
	uncacheWebhook() {
		this.webhook = null;
		this.ready = false;

		return this;
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
			version: MC_CLIENT_VERSION,
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
	 * @param {string} [prefix='']
	 */
	_hypixelSpamBypass(string, prefix = '') {
		const input = string.split('');

		// max message length is 256 post 1.11, 100 pre 1.11
		for (let index = this.maxMessageLength - string.length - prefix.length + 1; --index;) {
			input.splice(Math.floor(Math.random() * input.length), 0, randomInvisibleCharacter());
		}

		return `${prefix}${input.join('')}`;
	}

	/**
	 * escapes all standalone occurrences of 'ez', case-insensitive
	 * @param {string} string
	 */
	_escapeEz(string) {
		return string.replace(/(?<=\be+)(?=z+\b)/gi, randomInvisibleCharacter());
	}

	/**
	 * replaces discord renders with names
	 * @param {string} string
	 */
	_parseDiscordMessageToMinecraft(string) {
		return cleanFormattedNumber(string)
			.replace(/<?(?:a)?:?(\w{2,32}):(?:\d{17,19})>?/g, ':$1:') // custom emojis
			.replace(emojiRegex, match => unicodeToName[match] ?? match) // default emojis
			.replace(/\u{2022}/gu, '\u{25CF}') // better bullet points
			.replace(/<#(\d{17,19})>/g, (match, p1) => { // channels
				const channelName = this.client.channels.cache.get(p1)?.name;
				if (channelName) return `#${channelName}`;
				return match;
			})
			.replace(/<@&(\d{17,19})>/g, (match, p1) => { // roles
				const roleName = this.client.lgGuild?.roles.cache.get(p1)?.name;
				if (roleName) return `@${roleName}`;
				return match;
			})
			.replace(/<@!?(\d{17,19})>/g, (match, p1) => { // users
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
			string
				.replace( // emojis (custom and default)
					/(?<!<a?):(\S+):(?!\d{17,19}>)/g,
					(match, p1) => this.client.emojis.cache.find(({ name }) => name.toLowerCase() === p1.toLowerCase())?.toString() ?? nameToUnicode[match.replace(/_/g, '').toLowerCase()] ?? match,
				)
				.replace( // emojis (custom and default)
					/(?<!<a?):(\S+?):(?!\d{17,19}>)/g,
					(match, p1) => this.client.emojis.cache.find(({ name }) => name.toLowerCase() === p1.toLowerCase())?.toString() ?? nameToUnicode[match.replace(/_/g, '').toLowerCase()] ?? match,
				)
				.replace( // channels
					/#([a-z-]+)/gi,
					(match, p1) => this.client.lgGuild?.channels.cache.find(({ name }) => name === p1.toLowerCase())?.toString() ?? match,
				)
				.replace( // @mentions
					/(?<!<)@(!|&)?(\S+)(?!\d{17,19}>)/g,
					(match, p1, p2) => {
						switch (p1) {
							case '!': // members/users
								return this.client.lgGuild?.members.cache.find(({ displayName }) => displayName.toLowerCase() === p2.toLowerCase())?.toString() // members
									?? this.client.users.cache.find(({ username }) => username.toLowerCase() === p2.toLowerCase())?.toString() // users
									?? match;

							case '&': // roles
								return this.client.lgGuild?.roles.cache.find(({ name }) => name.toLowerCase() === p2.toLowerCase())?.toString() // roles
									?? match;

							default: { // players, members/users, roles
								const player = this.client.players.cache.find(({ ign }) => ign.toLowerCase() === p2.toLowerCase());

								if (player?.inDiscord) return `<@${player.discordID}>`;

								return this.client.lgGuild?.members.cache.find(({ displayName }) => displayName.toLowerCase() === p2.toLowerCase())?.toString() // members
									?? this.client.users.cache.find(({ username }) => username.toLowerCase() === p2.toLowerCase())?.toString() // users
									?? this.client.lgGuild?.roles.cache.find(({ name }) => name.toLowerCase() === p2.toLowerCase())?.toString() // roles
									?? match;
							}
						}
					},
				),
			{
				codeBlock: false,
				inlineCode: false,
				codeBlockContent: false,
				inlineCodeContent: false,
			},
		);
	}

	/**
	 * forwards a discord message to ingame guild chat, prettifying discord renders
	 * @param {import('../extensions/Message')} discordMessage
	 * @param {import('../database/models/Player')} player
	 */
	async forwardDiscordMessageToHypixelGuildChat(discordMessage, player) {
		return this.gchat(
			discordMessage.attachments.size ? [ discordMessage.content?.length ? discordMessage.content : null, ...discordMessage.attachments.map(({ url }) => url) ].filter(Boolean).join(' ') : discordMessage.content,
			{
				prefix: `${player?.ign ?? this._escapeEz(discordMessage.member?.displayName ?? discordMessage.author.username)}:`,
				discordMessage,
			},
		);
	}

	/**
	 * send a message to ingame guild chat
	 * @param {string} message
	 * @param {ChatOptions} options
	 */
	async gchat(message, { prefix = '', ...options } = {}) {
		if (this.bot.player.muted) {
			if (this.client.config.getBoolean('CHAT_LOGGING_ENABLED')) {
				logger.debug(`[GCHAT]: bot muted for ${ms(this.bot.player.chatBridgeMutedUntil - Date.now(), { long: true })}, unable to send '${prefix}${prefix.length ? ' ' : ''}${message}`);
			}

			return false;
		}

		return this.chat(message, { prefix: `/gc ${prefix}${prefix.length ? ' ' : randomInvisibleCharacter()}`, ...options });
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
		return memeRegExp.test(string) || blockedWordsRegExp.test(string);
	}

	/**
	 * checks the string for any non-whitespace character
	 * @param {string} string
	 */
	includesNonWhitespace(string) {
		return nonWhiteSpaceRegExp.test(string);
	}

	/**
	 * splits the message into the max ingame chat length, prefixes all parts and sends them
	 * @param {string} message
	 * @param {ChatOptions} options
	 * @returns {Promise<boolean>} success - wether all message parts were send
	 */
	async chat(message, { prefix = '', maxParts = this.client.config.getNumber('DEFAULT_MAX_PARTS'), discordMessage } = {}) {
		let success = true;

		/** @type {Set<string>} */
		const messageParts = new Set(
			this._escapeEz(this._parseDiscordMessageToMinecraft(message))
				.split('\n')
				.flatMap((part) => {
					try {
						return splitMessage(part, { char: ' ', maxLength: this.maxMessageLength - prefix.length });
					} catch { // fallback in case the splitMessage throws if it doesn't contain any ' '
						return splitMessage(part, { char: '', maxLength: this.maxMessageLength - prefix.length });
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

		if (!messageParts.size) return false;

		if (messageParts.size > maxParts || !success) discordMessage?.reactSafely(STOP);

		let partCount = 0;

		// waits between queueing each part to not clog up the queue if someone spams
		for (const part of messageParts) {
			if (++partCount <= maxParts) { // prevent sending more than 'maxParts' messages
				await this.sendToMinecraftChat(part, { prefix, discordMessage, shouldUseSpamByPass: true });
			} else {
				if (this.client.config.getBoolean('CHAT_LOGGING_ENABLED')) logger.warn(`[CHATBRIDGE CHAT]: skipped '${prefix}${part}'`);
				success = false;
			}
		}

		return success;
	}

	/**
	 * queue a message for the ingame chat
	 * @param {string} message
	 * @param {object} [options]
	 * @param {string} [options.prefix='']
	 * @param {boolean} [options.shouldUseSpamByPass=false]
	 * @param {import('../extensions/Message')} [options.discordMessage=null]
	 */
	async sendToMinecraftChat(message, { discordMessage = null, ...options } = {}) {
		if (discordMessage?.deleted) {
			if (this.client.config.getBoolean('CHAT_LOGGING_ENABLED')) logger.warn(`[CHATBRIDGE CHAT]: deleted on discord: '${options.prefix ?? ''}${message}'`);
			return;
		}

		await this.ingameQueue.wait();

		try {
			this.ingameChat.discordMessage = discordMessage;
			this.ingameChat.retries = 0;

			return await this._chat(message, options);
		} catch (error) {
			logger.error(`[CHATBRIDGE MC CHAT]: ${error}`);
		} finally {
			this.ingameChat.discordMessage = null;
			this.ingameQueue.shift();
		}
	}

	/**
	 * internal chat method with error listener and retries, should only ever be called from inside 'sendToMinecraftChat'
	 * @private
	 * @param {string} message
	 * @param {object} [options]
	 * @param {string} [options.prefix='']
	 * @param {boolean} [options.shouldUseSpamByPass=false]
	 * @returns {Promise<boolean>}
	 */
	async _chat(message, { prefix = '', shouldUseSpamByPass = false } = {}) {
		// send message to in game chat
		this.bot.chat(shouldUseSpamByPass
			? this._hypixelSpamBypass(message, prefix)
			: `${prefix}${message}`,
		);

		// listen for responses
		try {
			const [ response ] = await this.awaitMessages(
				msg => (msg.me && msg.content.endsWith(message)) || (!msg.type && (spamMessages.includes(msg.content) || msg.content.startsWith('We blocked your comment'))),
				{
					max: 1,
					time: this.ingameChat.safeDelay,
					errors: [ 'disconnect' ],
				},
			);

			// collector collected nothing
			if (!response) {
				logger.error(`no response from '${prefix}${message}'`);
				this.ingameChat.discordMessage?.reactSafely(X_EMOJI);
				this.ingameChat.tempIncrementCounter();
				return false;
			}

			// anti spam failed -> retry
			if (spamMessages.includes(response.content)) {
				this.ingameChat.tempIncrementCounter();

				// max retries reached
				if (++this.ingameChat.retries === this.ingameChat.maxRetries) {
					this.ingameChat.discordMessage?.reactSafely(X_EMOJI);
					await sleep(this.ingameChat.retries * this.ingameChat.safeDelay);
					return false;
				}

				await sleep(this.ingameChat.retries * this.ingameChat.safeDelay);
				return this._chat.apply(this, arguments); // eslint-disable-line prefer-spread
			}

			// hypixel content filter
			if (response.content.startsWith('We blocked your comment')) {
				this.ingameChat.discordMessage?.reactSafely(STOP);
				await sleep(this.ingameChat.delay);
				return false;
			}

			// message sent successfully
			await sleep([ GUILD, PARTY, OFFICER ].includes(response.type)
				? this.ingameChat.delay
				: (this.ingameChat.tempIncrementCounter(), this.ingameChat.safeDelay),
			);
			return true;

		// bot disconnected
		} catch {
			this.ingameChat.discordMessage?.reactSafely(X_EMOJI);
			await sleep(this.ingameChat.delay);
			return false;
		}
	}

	/**
	 * @typedef {import('discord.js').MessageOptions} DiscordMessageOptions
	 * @property {string} [prefix]
	 */

	/**
	 * send a message both to discord and the ingame guild chat, parsing both
	 * @param {string} message
	 * @param {object} param1
	 * @param {DiscordMessageOptions} [param1.discord]
	 * @param {ChatOptions} [param1.ingame]
	 * @returns {Promise<[boolean, ?import('../extensions/Message')|import('../extensions/Message')[]]>}
	 */
	async broadcast(message, { discord: { prefix: discordPrefix = '', ...discord } = {}, ingame: { prefix = '', maxParts = Infinity, ...options } = {} } = {}) {
		return Promise.all([
			this.gchat(message, { prefix, maxParts, ...options }),
			(async () => {
				if (!this.enabled) return null;

				await this.discordQueue.wait();

				try {
					return await this.channel?.send(this._parseMinecraftMessageToDiscord(`${discordPrefix}${message}`), discord);
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
			logger.error(`[CHATBRIDGE WEBHOOK]: ${this.logInfo}: ${error}`);
			if (error instanceof DiscordAPIError && error.method === 'get' && error.code === 0 && error.httpStatus === 404) {
				this.uncacheWebhook();
				this.reconnect();
			}
			throw error;
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
	 * @param {RegExp} [options.responseRegex=defaultResponseRegExp] regex to use as a filter for the message collector
	 * @param {number} [options.max=1] stop the collector after receiving this amount of messages
	 * @param {number} [options.timeout]
	 * @param {boolean} [options.rejectOnTimeout=false] wether to reject the promise if the collected amount is less than max
	 * @param {boolean} [options.raw=false] wether to return the full message object instead of the content
	 * @returns {Promise<string|import('./HypixelMessage')[]>}
	 */
	async command({ command = arguments[0], responseRegex = defaultResponseRegExp, max = 1, timeout = this.client.config.getNumber('INGAME_RESPONSE_TIMEOUT'), rejectOnTimeout = false, raw = false }) {
		const TIMEOUT_MS = timeout * 1_000;

		try {
			const result = await Promise.all([
				this.awaitMessages(
					msg => !msg.type && responseRegex.test(msg.content),
					{
						max,
						time: TIMEOUT_MS + (this.ingameQueue.remaining * this.ingameChat.safeDelay),
						errors: [ 'time', 'disconnect' ],
					},
				),
				this.sendToMinecraftChat(trim(`/${command}`, this.maxMessageLength - 1)),
			]);

			return raw
				? result[0]
				: result[0]
					.map(({ content }) => this.cleanCommandResponse(content))
					.join('\n');
		} catch (error) {
			// collector ended with reason 'time' or 'disconnect' -> collected nothing
			if (Array.isArray(error)) {
				if (rejectOnTimeout) Promise.reject(
					raw
						? error
						: error.length
							? error
								.map(({ content }) => this.cleanCommandResponse(content))
								.join('\n')
							: `no ingame response after ${ms(TIMEOUT_MS, { long: true })}`,
				);

				return raw
					? error
					: error.length
						? error
							.map(({ content }) => this.cleanCommandResponse(content))
							.join('\n')
						: `no ingame response after ${ms(TIMEOUT_MS, { long: true })}`;
			}

			// a different error occurred
			throw error;
		}
	}

	/**
	 * removes line formatters from the beginning and end
	 * @param {string} string
	 */
	cleanCommandResponse(string) {
		return string.replace(/^-{50,}|-{50,}$/g, '').trim();
	}
}

module.exports = ChatBridge;
