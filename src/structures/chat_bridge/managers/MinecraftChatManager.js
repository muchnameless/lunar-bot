'use strict';

const { MessageEmbed, SnowflakeUtil, Formatters } = require('discord.js');
const { AsyncQueue } = require('@sapphire/async-queue');
const { setTimeout: sleep } = require('timers/promises');
const { stripIndents } = require('common-tags');
const ms = require('ms');
const emojiRegex = require('emoji-regex/es2015')();
const { trim, cleanFormattedNumber, splitMessage } = require('../../../functions/util');
const { unicodeToName } = require('../constants/emojiNameUnicodeConverter');
const { memeRegExp, nonWhiteSpaceRegExp, invisibleCharacterRegExp, randomInvisibleCharacter, randomPadding, messageTypes: { GUILD, PARTY, OFFICER } } = require('../constants/chatBridge');
const { STOP, X_EMOJI } = require('../../../constants/emojiCharacters');
const { MC_CLIENT_VERSION } = require('../constants/settings');
const { GUILD_ID_BRIDGER, UNKNOWN_IGN } = require('../../../constants/database');
const minecraftBot = require('../MinecraftBot');
const UserUtil = require('../../../util/UserUtil');
const GuildMemberUtil = require('../../../util/GuildMemberUtil');
const MessageUtil = require('../../../util/MessageUtil');
const MessageCollector = require('../MessageCollector');
const ChatManager = require('./ChatManager');
const cache = require('../../../api/cache');
const logger = require('../../../functions/logger');

/**
 * @typedef {object} SendToChatOptions
 * @property {string} content
 * @property {string} [prefix='']
 * @property {boolean} [isMessage]
 * @property {?import('discord.js').Message} [discordMessage=null]
 */

/**
 * @typedef {object} CommandOptions
 * @property {string} command can also directly be used as the only parameter
 * @property {?RegExp} [responseRegExp] regex to use as a filter for the message collector
 * @property {?RegExp} [abortRegExp] regex to detect an abortion response
 * @property {number} [max=-1] maximum amount of response messages, -1 or Infinity for an infinite amount
 * @property {boolean} [raw=false] wether to return an array of the collected hypixel message objects instead of just the content
 * @property {number} [timeout=config.get('INGAME_RESPONSE_TIMEOUT')] response collector timeout in milliseconds
 * @property {boolean} [rejectOnTimeout=false] wether to reject the promise if the collected amount is less than max
 * @property {boolean} [rejectOnAbort=false] wether to reject the promise if the abortRegExp triggered
 */


module.exports = class MinecraftChatManager extends ChatManager {
	constructor(...args) {
		super(...args);

		/**
		 * current retry when resending messages
		 */
		this.retries = 0;
		/**
		 * how many messages have been sent to in game chat in the last 10 seconds
		 */
		this.messageCounter = 0;
		/**
		 * @type {?string}
		 */
		this._contentFilter = null;
		/**
		 * wether the message sent collector is active
		 */
		this._collecting = false;
		/**
		 * resolves this._promise
		 */
		this._resolve;
		/**
		 * @type {Promise<'spam'|'blocked'|import('../HypixelMessage')>}
		 */
		this._promise = new Promise(res => this._resolve = res);
		/**
		 * async queue for minecraft commands, prevents multiple response collectors
		 */
		this.commandQueue = new AsyncQueue();
		/**
		 * @type {import('minecraft-protocol').Client}
		 */
		this.bot = null;
		/**
		 * @type {?string}
		 */
		this.botUuid = null;
		/**
		 * bot player db object
		 * @type {?import('../../database/models/Player')}
		 */
		this._botPlayer = null;
		/**
		 * wether the minecraft bot is logged in and ready to receive and send chat messages
		 */
		this.botReady = false;
		/**
		 * disconnect the bot if it hasn't successfully spawned in 60 seconds
		 */
		this.abortLoginTimeout = null;
		/**
		  * scheduled reconnection
		  */
		this._reconnectTimeout = null;
		/**
		  * increases each login, reset to 0 on successfull spawn
		  */
		this.loginAttempts = 0;
		/**
		 * wether the chatBridge mc bot is currently isReconnecting (prevents executing multiple reconnections)
		 */
		this._isReconnecting = false;
		/**
		  * to prevent chatBridge from reconnecting at <MinecraftBot>.end
		  */
		this.shouldReconnect = true;
		/**
		 * command response collector
		 */
		this._commandCollector = null;
		/**
		 * anti spam checker
		 */
		this._lastMessages = {
			MAX_INDEX: 8,
			index: -1,
			incIndex() {
				++this.index;
				if (this.index === this.MAX_INDEX) this.index = 0;
			},
			decIndex() {
				--this.index;
				if (this.index === -1) this.index = this.MAX_INDEX - 1;
			},
			/**
			 * @type {string[]}
			 */
			cache: [],
			cleanContent(content) {
				return content
					.replace(/\d/g, '') // remove numbers
					.replace(invisibleCharacterRegExp, '') // remove invis chars
					.trim() // remove whitespaces at the beginning and end
					.replace(/ {2,}/g, ' '); // only single spaces
			},
			/**
			 * @param {string} content
			 */
			check(content) {
				return this.cache.includes(this.cleanContent(content));
			},
			add(content) {
				this.incIndex();
				this.cache[this.index] = this.cleanContent(content);
			},
		};
	}

	/**
	 * wether the minecraft bot is logged in and ready to receive and send chat messages
	 */
	get ready() {
		return this.botReady && !(this.bot?.ended ?? true);
	}

	set ready(value) {
		this.botReady = value;
	}

	/**
	 * bot player db object
	 * @returns {?import('../../database/models/Player')}
	 */
	get botPlayer() {
		return this._botPlayer ??= this.client.players.cache.get(this.botUuid) ?? null;
	}

	set botPlayer(value) {
		this._botPlayer = value;
	}

	/**
	 * @returns {Promise<string>}
	 */
	get server() {
		return (async () => {
			try {
				const result = await this.command({
					command: 'locraw',
					responseRegExp: /^{.+}$/s,
					rejectOnTimeout: true,
					max: 1,
				});

				return JSON.parse(result).server ?? null;
			} catch (error) {
				logger.error('[GET SERVER]', error);
				return null;
			}
		})();
	}

	/**
	 * wether the minecraft bot can send chat messages
	 * @returns {Promise<boolean>}
	 */
	get chatReady() {
		return (async () => {
			if (!this.bot) return false;

			try {
				await this.command({
					command: `w ${this.bot.username} o/`,
					responseRegExp: /^You cannot message this player\.$/,
					timeout: 1_000,
					rejectOnTimeout: true,
					max: 1,
				});

				return true;
			} catch {
				return false;
			}
		})();
	}

	/**
	 * maximum attempts to resend to in game chat
	 */
	static MAX_RETRIES = 3;

	/**
	 * normal delay to listen for error messages
	 */
	static delays = [
		null,
		100,
		100,
		100,
		120,
		150,
		600,
	];

	/**
	 * delay which can be used to send messages to in game chat continously
	 */
	static SAFE_DELAY = 600;

	/**
	 * delay which can be used after triggering anti spam
	 */
	static ANTI_SPAM_DELAY = 1_000;

	/**
	 * 100 pre 1.10.2, 256 post 1.10.2
	 * @type {number}
	 */
	static MAX_MESSAGE_LENGTH = require('minecraft-data')(MC_CLIENT_VERSION).version.version > require('minecraft-data')('1.10.2').version.version
		? 256
		: 100;

	/**
	 * reacts to the message and DMs the author
	 * @param {import('discord.js').Message} discordMessage
	 * @param {string} reason
	 * @param {?Record<string, any>}
	 */
	async #handleForwardRejection(discordMessage, reason, data) {
		if (!discordMessage) return;

		MessageUtil.react(discordMessage, STOP);

		if (await cache.get(`chatbridge:blocked:dm:${discordMessage.author.id}`)) return;

		try {
			let info;

			switch (reason) {
				case 'blocked': {
					try {
						/** @type {import('../../database/models/Player')} */
						const player = UserUtil.getPlayer(discordMessage.author)
							?? (await this.client.players.model.findOrCreate({
								where: { discordId: discordMessage.author.id },
								defaults: {
									minecraftUuid: SnowflakeUtil.generate(),
									guildId: GUILD_ID_BRIDGER,
									ign: UNKNOWN_IGN,
									inDiscord: true,
								},
							}))[0];

						player.addInfraction();

						const { infractions } = player;

						if (infractions >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS') && !player.muted) {
							const MUTE_DURATION = this.client.config.get('CHATBRIDGE_AUTOMUTE_DURATION');

							player.mutedTill = Date.now() + MUTE_DURATION;
							player.save();

							const MUTE_DURATION_LONG = ms(MUTE_DURATION, { long: true });

							this.client.log(new MessageEmbed()
								.setColor(this.client.config.get('EMBED_RED'))
								.setAuthor(discordMessage.author.tag, discordMessage.author.displayAvatarURL({ dynamic: true }), player.url)
								.setThumbnail(player.image)
								.setDescription(stripIndents`
									${Formatters.bold('Auto Muted')} for ${MUTE_DURATION_LONG} due to ${infractions} infractions in the last ${ms(this.client.config.get('INFRACTIONS_EXPIRATION_TIME'), { long: true })}
									${player.info}
								`)
								.setTimestamp(),
							);

							info = `you were automatically muted for ${MUTE_DURATION_LONG} due to continues infractions`;
						}
					} catch (error) {
						logger.error(`[FORWARD REJECTION]: ${discordMessage.author.tag}`, error);
					}

					info ??= 'continuing to do so will result in an automatic temporary mute';
				}
				// fallthrough
				case 'filterBlocked':
					info = stripIndents`
						your message was blocked because you used a blocked word or character
						(the blocked words filter is to comply with hypixel's chat rules, removing it would simply result in a "We blocked your comment as it breaks our rules"-message)

						${info ?? ''}
					`;
					break;

				case 'messageCount':
					info = stripIndents`
						your message was blocked because you are only allowed to send up to ${data?.maxParts ?? this.client.config.get('CHATBRIDGE_DEFAULT_MAX_PARTS')} messages at once
						(in game chat messages can only be up to 256 characters long and new lines are treated as new messages)
					`;
					break;

				default:
					throw new Error('invalid rejection case');
			}

			await UserUtil.sendDM(discordMessage.author, info);

			logger.info(`[FORWARD REJECTION]: DMed ${discordMessage.author.tag}`);
		} catch (error) {
			logger.error(`[FORWARD REJECTION]: error DMing ${discordMessage.author.tag}`, error);
		} finally {
			cache.set(`chatbridge:blocked:dm:${discordMessage.author.id}`, true, 60 * 60_000); // prevent DMing again in the next hour
		}
	}

	/**
	 * removes line formatters from the beginning and end
	 * @param {import('../HypixelMessage')} messages
	 */
	static #cleanCommandResponse(messages) {
		return messages
			.map(({ content }) => content.replace(/^-{29,}|-{29,}$/g, '').trim())
			.join('\n');
	}

	/**
	 * increasing delay
	 */
	get delay() {
		return MinecraftChatManager.delays[this.#tempIncrementCounter()] ?? MinecraftChatManager.SAFE_DELAY;
	}

	/**
	 * create bot instance, loads and binds it's events and logs it into hypixel
	 */
	async #createBot() {
		++this.loginAttempts;

		return this.bot = await minecraftBot(this.chatBridge, {
			host: process.env.MINECRAFT_SERVER_HOST,
			port: Number(process.env.MINECRAFT_SERVER_PORT),
			username: process.env.MINECRAFT_USERNAME.split(' ')[this.mcAccount],
			password: process.env.MINECRAFT_PASSWORD.split(' ')[this.mcAccount],
			version: MC_CLIENT_VERSION,
			auth: process.env.MINECRAFT_ACCOUNT_TYPE.split(' ')[this.mcAccount],
		});
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

		await this.#createBot();

		// reconnect the bot if it hasn't successfully spawned in 60 seconds
		if (!this.ready) {
			this.abortLoginTimeout = setTimeout(() => {
				logger.warn('[CHATBRIDGE ABORT TIMER]: login abort triggered');
				this.reconnect(0);
			}, 60_000);
		}

		this._isReconnecting = false;

		return this;
	}

	/**
	 * reconnects the bot, exponential login delay up to 10 min
	 * @param {number} [loginDelay] delay in ms
	 */
	reconnect(loginDelay = Math.min(Math.exp(this.loginAttempts) * 1_000, 600_000)) {
		// prevent multiple reconnections
		if (this._isReconnecting) return this;
		this._isReconnecting = true;

		this.disconnect();

		logger.warn(`[CHATBRIDGE RECONNECT]: attempting reconnect in ${ms(loginDelay, { long: true })}`);

		this._reconnectTimeout = setTimeout(() => {
			this.connect();
			this._reconnectTimeout = null;
		}, loginDelay);

		return this;
	}

	/**
	 * disconnects the bot
	 */
	disconnect() {
		clearTimeout(this._reconnectTimeout);
		this._reconnectTimeout = null;

		clearTimeout(this.abortLoginTimeout);
		this.abortLoginTimeout = null;

		this.ready = false;

		try {
			this.bot?.end('disconnect.quitting');
		} catch (error) {
			logger.error('[CHATBRIDGE DISCONNECT]', error);
		}

		this.bot = null;

		return this;
	}

	/**
	 * @param {string|import('../HypixelMessage')} value
	 */
	#resolveAndReset(value) {
		this._resolve(value);
		this.#resetFilter();
		this._promise = new Promise(res => this._resolve = res);
	}

	/**
	 * @param {import('../HypixelMessage')} hypixelMessage
	 */
	collect(hypixelMessage) {
		if (!this._collecting) return;
		if (hypixelMessage.me && hypixelMessage.content.includes(this._contentFilter)) return this.#resolveAndReset(hypixelMessage);
		if (hypixelMessage.type) return;
		if (hypixelMessage.spam) return this.#resolveAndReset('spam');
		if (hypixelMessage.content.startsWith('We blocked your comment')) return this.#resolveAndReset('blocked');
	}

	/**
	 * returns a Promise that resolves with a message that ends with the provided content
	 * @param {string} content
	 */
	listenFor(content) {
		this._contentFilter = content;
		this._collecting = true;
		return this._promise;
	}

	/**
	 * resets the listener filter
	 */
	#resetFilter() {
		this._contentFilter = null;
		this._collecting = false;
	}

	/**
	 * increments messageCounter for 10 seconds
	 */
	#tempIncrementCounter() {
		setTimeout(() => --this.messageCounter, 10_000);
		return ++this.messageCounter;
	}

	/**
	 * collects chat messages from the bot
	 * @param {import('../MessageCollector').MessageCollectorOptions} options
	 */
	createMessageCollector(options = {}) {
		return new MessageCollector(this.chatBridge, options);
	}

	/**
	 * discord markdown -> readable string
	 * @param {string} string
	 */
	parseContent(string) {
		return cleanFormattedNumber(string)
			.replace(/ {2,}/g, ' ') // mc chat displays multiple whitespace as 1
			.replace(invisibleCharacterRegExp, '') // remove invisible characters
			.replace(/<(?:a)?:(\w{2,32}):(?:\d{17,19})>/g, ':$1:') // custom emojis
			.replace(emojiRegex, match => unicodeToName[match] ?? match) // default emojis
			.replace(/\u{2022}/gu, '\u{25CF}') // better bullet points
			.replace(/<#(\d{17,19})>/g, (match, p1) => { // channels
				const CHANNEL_NAME = this.client.channels.cache.get(p1)?.name;
				if (CHANNEL_NAME) return `#${CHANNEL_NAME}`;
				return match;
			})
			.replace(/<@&(\d{17,19})>/g, (match, p1) => { // roles
				const ROLE_NAME = this.client.lgGuild?.roles.cache.get(p1)?.name;
				if (ROLE_NAME) return `@${ROLE_NAME}`;
				return match;
			})
			.replace(/<@!?(\d{17,19})>/g, (match, p1) => { // users
				const member = this.client.lgGuild?.members.cache.get(p1);
				if (member) {
					const player = GuildMemberUtil.getPlayer(member);
					if (player) return `@${player}`;
				}

				const user = this.client.users.cache.get(p1);
				if (user) {
					const player = UserUtil.getPlayer(user);
					if (player) return `@${player}`;
				}

				const NAME = member?.displayName ?? user?.username;
				if (NAME) return `@${NAME}`;

				return match;
			})
			.replace(/<t:(-?\d{1,13})(?::([tTdDfFR]))?>/g, (match, p1, p2) => { // dates
				const date = new Date(p1 * 1_000);

				if (Number.isNaN(date.getTime())) return match; // invalid date

				switch (p2) { // https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
					case Formatters.TimestampStyles.ShortTime:
						return date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: 'UTC' });

					case Formatters.TimestampStyles.LongTime:
						return date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short', timeZone: 'UTC' });

					case Formatters.TimestampStyles.ShortDate:
						return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

					case Formatters.TimestampStyles.LongDate:
						return date.toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

					case Formatters.TimestampStyles.ShortDateTime:
						return date.toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: 'UTC' });

					case Formatters.TimestampStyles.LongDateTime:
						return date.toLocaleString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: 'UTC' });

					case Formatters.TimestampStyles.RelativeTime: {
						const TIME = date.getTime() - Date.now();
						if (TIME > 0) return `in ${ms(Math.abs(TIME), { long: true })}`;
						return `${ms(Math.abs(TIME), { long: true })} ago`;
					}

					default:
						return date.toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: 'UTC' });
				}
			});
	}

	/**
	 * send a message to in game guild chat
	 * @param {string | import('../ChatBridge').ChatOptions} contentOrOptions
	 */
	async gchat(contentOrOptions) {
		const { prefix = '', ...options } = MinecraftChatManager.resolveInput(contentOrOptions);

		if (this.botPlayer?.muted) {
			if (this.client.config.get('CHAT_LOGGING_ENABLED')) {
				logger.debug(`[GCHAT]: bot muted for ${ms(this.botPlayer.mutedTill - Date.now(), { long: true })}, unable to send '${prefix}${prefix.length ? ' ' : ''}${options.content}`);
			}

			return false;
		}

		return this.chat({ prefix: `/gc ${prefix}${prefix.length ? ' ' : randomInvisibleCharacter()}`, ...options });
	}

	/**
	 * send a message to in game guild chat
	 * @param {string | import('../ChatBridge').ChatOptions} contentOrOptions
	 */
	async ochat(contentOrOptions) {
		const { prefix = '', ...options } = MinecraftChatManager.resolveInput(contentOrOptions);

		return this.chat({ prefix: `/oc ${prefix}${prefix.length ? ' ' : randomInvisibleCharacter()}`, ...options });
	}

	/**
	 * send a message to in game party chat
	 * @param {string | import('../ChatBridge').ChatOptions} contentOrOptions
	 */
	async pchat(contentOrOptions) {
		const { prefix = '', ...options } = MinecraftChatManager.resolveInput(contentOrOptions);

		return this.chat({ prefix: `/pc ${prefix}${prefix.length ? ' ' : randomInvisibleCharacter()}`, ...options });
	}

	/**
	 * resolves content or options to an options object
	 * @param {string | import('../ChatBridge').ChatOptions} contentOrOptions
	 * @returns {import('../ChatBridge').ChatOptions}
	 */
	static resolveInput(contentOrOptions) {
		return typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;
	}

	/**
	 * splits the message into the max in game chat length, prefixes all parts and sends them
	 * @param {string | import('../ChatBridge').ChatOptions} contentOrOptions
	 * @param {import('../ChatBridge').ChatOptions} [options]
	 * @returns {Promise<boolean>} success - wether all message parts were send
	 */
	async chat(contentOrOptions) {
		const { content, prefix = '', maxParts = this.client.config.get('CHATBRIDGE_DEFAULT_MAX_PARTS'), discordMessage } = MinecraftChatManager.resolveInput(contentOrOptions);

		if (!content) return false;

		let success = true;

		/** @type {Set<string>} */
		const contentParts = new Set(
			this.parseContent(content)
				.split('\n')
				.flatMap(part => splitMessage(part, { char: [ ' ', '' ], maxLength: MinecraftChatManager.MAX_MESSAGE_LENGTH - prefix.length }))
				.filter((part) => {
					if (nonWhiteSpaceRegExp.test(part)) { // filter out white space only parts
						if (ChatManager.BLOCKED_WORDS_REGEXP.test(part) || memeRegExp.test(part)) {
							if (this.client.config.get('CHAT_LOGGING_ENABLED')) logger.warn(`[CHATBRIDGE CHAT]: blocked '${part}'`);
							return success = false;
						}
						return true;
					}

					// part consists of only whitespace characters -> ignore
					if (this.client.config.get('CHAT_LOGGING_ENABLED')) logger.warn(`[CHATBRIDGE CHAT]: ignored '${part}'`);
					return false;
				}),
		);

		if (!success) { // messageParts blocked
			this.#handleForwardRejection(discordMessage, 'filterBlocked');
			return false;
		}

		if (!contentParts.size) return false;

		if (contentParts.size > maxParts) {
			this.#handleForwardRejection(discordMessage, 'messageCount', { maxParts });
			return false;
		}

		// waits between queueing each part to not clog up the queue if someone spams
		for (const part of contentParts) {
			success = await this.sendToChat({ content: part, prefix, discordMessage, isMessage: true }) && success;
		}

		return success;
	}

	/**
	 * queue a message for the in game chat
	 * @param {string | SendToChatOptions} contentOrOptions
	 */
	async sendToChat(contentOrOptions) {
		const data = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		if (data.discordMessage?.deleted) {
			if (this.client.config.get('CHAT_LOGGING_ENABLED')) logger.warn(`[CHATBRIDGE CHAT]: deleted on discord: '${data.prefix ?? ''}${data.content}'`);
			return false;
		}

		await this.queue.wait();

		try {
			await this.#sendToChat(data);
			return true;
		} catch (error) {
			logger.error('[CHATBRIDGE MC CHAT]', error);
			return false;
		} finally {
			this.retries = 0;
			this.queue.shift();
		}
	}

	/**
	 * internal chat method with error listener and retries, should only ever be called from inside 'sendToChat' or 'command'
	 * @private
	 * @param {SendToChatOptions} param0
	 * @returns {Promise<void>}
	 */
	async #sendToChat({ content, prefix = '', isMessage, discordMessage = null } = {}) {
		let message = `${prefix}${content}`;

		const useSpamBypass = isMessage ?? /^\/(?:[acgop]c|msg|w(?:hisper)?|t(?:ell)?) /i.test(message);

		if (useSpamBypass) {
			let index = this.retries;

			// 1 for each retry + additional if _lastMessages includes curent padding
			while ((--index >= 0 || this._lastMessages.check(message)) && (message.length + 6 <= MinecraftChatManager.MAX_MESSAGE_LENGTH)) {
				message += randomPadding();
			}
		}

		message = trim(message, MinecraftChatManager.MAX_MESSAGE_LENGTH);

		// create listener
		const listener = this.listenFor(content);

		try {
			this.bot.write('chat', { message });

			if (useSpamBypass) this._lastMessages.add(message);
		} catch (error) {
			logger.error('[CHATBRIDGE _SEND TO CHAT]', error);
			MessageUtil.react(discordMessage, X_EMOJI);

			this.#tempIncrementCounter();
			this.#resetFilter();

			throw error;
		}

		// listen for responses
		const response = await Promise.race([
			listener,
			sleep(MinecraftChatManager.SAFE_DELAY, 'timeout'),
		]);

		switch (response) {
			// collector collected nothing, sleep won the race. this happens for all commands which return a "system reply"
			case 'timeout': {
				this.#tempIncrementCounter();
				this.#resetFilter();

				// only throw for chat messages when the bot was not ready yet
				if (discordMessage && !this.ready) {
					MessageUtil.react(discordMessage, X_EMOJI);
					throw response;
				}

				return;
			}

			// anti spam failed -> retry
			case 'spam': {
				this.#tempIncrementCounter();
				this._lastMessages.decIndex();

				// max retries reached
				if (++this.retries === MinecraftChatManager.MAX_RETRIES) {
					MessageUtil.react(discordMessage, X_EMOJI);
					await sleep(this.retries * MinecraftChatManager.ANTI_SPAM_DELAY);
					throw `unable to send the message, anti spam failed ${MinecraftChatManager.MAX_RETRIES} times`;
				}

				await sleep(this.retries * MinecraftChatManager.ANTI_SPAM_DELAY);
				return this.#sendToChat(...arguments); // retry sending
			}

			// hypixel filter blocked message
			case 'blocked': {
				this._lastMessages.decIndex();

				this.#handleForwardRejection(discordMessage, 'blocked');
				await sleep(this.delay);
				throw 'unable to send the message, hypixel\'s filter blocked it';
			}

			// message sent successfully
			default: {
				await sleep([ GUILD, PARTY, OFFICER ].includes(response.type)
					? this.delay
					: (this.#tempIncrementCounter(), MinecraftChatManager.SAFE_DELAY),
				);
				return;
			}
		}
	}

	/**
	 * sends a message to in game chat and resolves with the first message.content within 'INGAME_RESPONSE_TIMEOUT' ms that passes the regex filter, also supports a single string as input
	 * @param {CommandOptions} commandOptions
	 */
	// eslint-disable-next-line no-undef
	async command({ command = arguments[0], responseRegExp, abortRegExp, max = -1, raw = false, timeout = this.client.config.get('INGAME_RESPONSE_TIMEOUT'), rejectOnTimeout = false, rejectOnAbort = false }) {
		await this.commandQueue.wait(); // only have one collector active at a time (prevent collecting messages from other command calls)
		await this.queue.wait(); // only start the collector if the chat queue is free

		const collector = this._commandCollector = this.createMessageCollector({
			filter: message => !message.type && ((responseRegExp?.test(message.content) ?? true) || (abortRegExp?.test(message.content) ?? false) || /^-{29,}/.test(message.content)),
			time: timeout,
		});

		let resolve;
		let reject;

		/** @type {Promise<string|import('../HypixelMessage')[]>} */
		const promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});

		// collect message
		collector.on('collect', (/** @type {import('../HypixelMessage')} */ message) => {
			if (/^-{29,}/.test(message.content)) { // is line separator
				// message starts and ends with a line separator (50+ * '-') but includes non '-' in the middle -> single message response detected
				if (/[^-]-{29,}$/.test(message.content)) return collector.stop();

				collector.collected.pop(); // remove line separator from collected messages
				if (collector.collected.length) collector.stop(); // stop collector if messages before this line separator were already collected
			} else if (collector.collected.length === max) { // message is not a line separator
				collector.stop();
			} else if (abortRegExp?.test(message.content)) { // abortRegExp triggered
				collector.stop('abort');
			} else if (message.spam) { // don't collect anti spam messages
				collector.collected.pop();
			}
		});

		// end collection
		collector.once('end', (/** @type {import('../HypixelMessage')[]} */ collected, /** @type {string} */ reason) => {
			this.commandQueue.shift();

			switch (reason) {
				case 'time':
				case 'disconnect': {
					if (rejectOnTimeout && !collected.length) {
						return reject(raw
							? [{ content: `no in game response after ${ms(timeout, { long: true })}` }]
							: `no in game response after ${ms(timeout, { long: true })}`,
						);
					}

					return resolve(raw
						? collected
						: collected.length
							? MinecraftChatManager.#cleanCommandResponse(collected)
							: `no in game response after ${ms(timeout, { long: true })}`);
				}

				case 'error':
					return;

				case 'abort': {
					if (rejectOnAbort) reject(raw
						? collected
						: MinecraftChatManager.#cleanCommandResponse(collected),
					);
				}
				// fallthrough

				default:
					return resolve(raw
						? collected
						: MinecraftChatManager.#cleanCommandResponse(collected),
					);
			}
		});

		// send command to chat
		(async () => {
			try {
				await this.#sendToChat({
					content: command,
					prefix: command.startsWith('/')
						? ''
						: '/',
					isMessage: false,
				});
			} catch (error) {
				logger.error('[CHATBRIDGE MC COMMAND]', error);
				reject(error);
				collector.stop('error');
			} finally {
				this.retries = 0;
				this.queue.shift();
			}
		})();

		return promise;
	}
};
