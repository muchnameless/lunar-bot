import { setTimeout as sleep } from 'node:timers/promises';
import { MessageEmbed, SnowflakeUtil, Formatters } from 'discord.js';
import { AsyncQueue } from '@sapphire/async-queue';
import { stripIndents } from 'common-tags';
import ms from 'ms';
import emojiRegex from 'emoji-regex';
import minecraftData from 'minecraft-data';
import {
	INVISIBLE_CHARACTER_REGEXP,
	INVISIBLE_CHARACTERS,
	MC_CLIENT_VERSION,
	MEME_REGEXP,
	MESSAGE_TYPES,
	NON_WHITESPACE_REGEXP,
	randomPadding,
	UNICODE_TO_EMOJI_NAME,
} from '../constants';
import { STOP_EMOJI, UNKNOWN_IGN, X_EMOJI } from '../../../constants';
import { createBot } from '../MinecraftBot';
import { MessageUtil, UserUtil } from '../../../util';
import { MessageCollector, MessageCollectorEvents } from '../MessageCollector';
import { cache } from '../../../api';
import {
	asyncReplace,
	cleanFormattedNumber,
	hours,
	logger,
	minutes,
	seconds,
	splitMessage,
	trim,
} from '../../../functions';
import { ChatManager } from './ChatManager';
import type { GuildChannel, Message } from 'discord.js';
import type { Client as MinecraftBot } from 'minecraft-protocol';
import type { MessageCollectorOptions } from '../MessageCollector';
import type { Player } from '../../database/models/Player';
import type { HypixelMessage } from '../HypixelMessage';
import type { If, Timeout } from '../../../types/util';
import type { ChatBridge, ChatOptions } from '../ChatBridge';

export interface SendToChatOptions {
	content: string;
	prefix?: string;
	isMessage?: boolean;
	discordMessage?: Message | null;
	/** wether to whisper to the author */
	ephemeral?: boolean;
}

export interface CommandOptions {
	/** can also directly be used as the only parameter */
	command: string;
	/** regex to use as a filter for the message collector */
	responseRegExp?: RegExp | null;
	/** regex to detect an abortion response */
	abortRegExp?: RegExp | null;
	/** maximum amount of response messages, -1 or Number.POSITIVE_INFINITY for an infinite amount */
	max?: number;
	/** wether to return an array of the collected hypixel message objects instead of just the content */
	raw?: boolean;
	/** response collector timeout in milliseconds */
	timeout?: number;
	/** wether to reject the promise if the collected amount is less than max */
	rejectOnTimeout?: boolean;
	/** wether to reject the promise if the abortRegExp triggered */
	rejectOnAbort?: boolean;
}

type FilterPromise = ChatResponse | HypixelMessage;

const enum ChatResponse {
	TIMEOUT,
	SPAM,
	BLOCKED,
}

const enum ForwardRejectionReason {
	HYPIXEL_BLOCKED,
	LOCAL_BLOCKED,
	MESSAGE_COUNT,
}

export class MinecraftChatManager<loggedIn extends boolean = boolean> extends ChatManager {
	/**
	 * resolves this.#promise
	 */
	#resolve!: (value: FilterPromise) => void;
	/**
	 * filter promise
	 */
	#promise: Promise<FilterPromise> = new Promise((res) => (this.#resolve = res));
	/**
	 * bot player db object
	 */
	#botPlayer: Player | null = null;
	/**
	 * filter for the message listener
	 */
	#contentFilter: string | null = null;
	/**
	 * wether the message sent collector is active
	 */
	#collecting = false;
	/**
	 * chatBridge mc bot reconnecting (prevents executing multiple reconnections)
	 */
	#reconnectPromise: Promise<this> | null = null;
	/**
	 * scheduled reconnection
	 */
	#reconnectTimeout: Timeout | null = null;
	/**
	 * current retry when resending messages
	 */
	#retries = 0;
	/**
	 * how many messages have been sent to in game chat in the last 10 seconds
	 */
	#messageCounter = 0;
	/**
	 * async queue for minecraft commands, prevents multiple response collectors
	 */
	#commandQueue = new AsyncQueue();
	/**
	 * wether the minecraft bot is logged in and ready to receive and send chat messages
	 */
	botReady = false;
	/**
	 * minecraft bot client
	 */
	bot: If<loggedIn, MinecraftBot> = null as If<loggedIn, MinecraftBot>;
	/**
	 * minecraft uuid of the bot user
	 */
	botUuid: If<loggedIn, string> = null as If<loggedIn, string>;
	/**
	 * disconnect the bot if it hasn't successfully spawned in 60 seconds
	 */
	abortLoginTimeout: Timeout | null = null;
	/**
	 * increases each login, reset to 0 on successfull spawn
	 */
	loginAttempts = 0;
	/**
	 * to prevent chatBridge from reconnecting at <MinecraftBot>.end
	 */
	shouldReconnect = true;
	/**
	 * anti spam checker
	 */
	_lastMessages = {
		/**
		 * buffer size
		 */
		MAX_INDEX: 8 as const,
		/**
		 * current buffer index
		 */
		index: -1,
		/**
		 * ring buffer
		 */
		cache: [] as string[],
		/**
		 * removes parts of the content which hypixel's spam filter ignores
		 * @param content
		 */
		_cleanContent(content: string) {
			return content
				.replace(/\d/g, '') // remove numbers
				.replace(/(?<=^\/)o(?=c)/, 'g') // oc and gc share the same anti spam bucket -> /oc -> /gc
				.replace(INVISIBLE_CHARACTER_REGEXP, '') // remove invis chars
				.trim() // remove whitespaces at the beginning and end
				.replace(/ {2,}/g, ' '); // mc messages can only have single spaces
		},
		/**
		 * check wether the content is already in the buffer
		 * @param content
		 */
		check(content: string) {
			return this.cache.includes(this._cleanContent(content));
		},
		/**
		 * add the content to the buffer
		 * @param content
		 */
		add(content: string) {
			// increment ring buffer index, reset cycle if max index
			if (++this.index === this.MAX_INDEX) this.index = 0;

			this.cache[this.index] = this._cleanContent(content);
		},
	};

	constructor(chatBridge: ChatBridge) {
		super(chatBridge);

		for (let i = 0; i < this._lastMessages.MAX_INDEX; ++i) {
			this._lastMessages.cache.push('');
		}
	}

	/**
	 * wether the minecraft bot is logged in and ready to receive and send chat messages
	 */
	isReady(): this is MinecraftChatManager<true> {
		return this.botReady && !(this.bot?.ended ?? true);
	}

	/**
	 * bot player db object
	 */
	get botPlayer() {
		return (this.#botPlayer ??= this.client.players.cache.get(this.botUuid!) ?? null);
	}

	set botPlayer(value) {
		this.#botPlayer = value;
	}

	/**
	 * hypixel server which the minecraft bot is on
	 */
	get server() {
		return (async () => {
			try {
				const result = await this.command({
					command: 'locraw',
					responseRegExp: /^\{.+\}$/s,
					rejectOnTimeout: true,
					max: 1,
				});

				return (JSON.parse(result).server as string) ?? null;
			} catch (error) {
				logger.error(error, '[GET SERVER]');
				return null;
			}
		})();
	}

	/**
	 * wether the minecraft bot can send chat messages
	 */
	get chatReady() {
		if (!this.bot) return Promise.resolve(false);

		return (async () => {
			try {
				await this.command({
					command: `w ${this.bot!.username} o/`,
					responseRegExp: /^You cannot message this player\.$/,
					timeout: seconds(1),
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
	static MAX_RETRIES = 3 as const;

	/**
	 * normal delay to listen for error messages
	 */
	static delays = [null, 100, 100, 100, 120, 150, 600] as const;

	/**
	 * delay which can be used to send messages to in game chat continously
	 */
	static SAFE_DELAY = 600 as const;

	/**
	 * delay which can be used after triggering anti spam
	 */
	static ANTI_SPAM_DELAY = seconds(1);

	/**
	 * 100 pre 1.10.2, 256 post 1.10.2
	 */
	static MAX_MESSAGE_LENGTH =
		minecraftData(MC_CLIENT_VERSION).version.version! > minecraftData('1.10.2').version.version!
			? (256 as const)
			: (100 as const);

	/**
	 * reacts to the message and DMs the author
	 * @param discordMessage
	 * @param reason
	 * @param data
	 */
	async #handleForwardRejection(
		discordMessage: Message | null,
		reason: ForwardRejectionReason,
		data?: Record<string, unknown>,
	) {
		if (!discordMessage) return;

		MessageUtil.react(discordMessage, STOP_EMOJI);

		let info;

		switch (reason) {
			case ForwardRejectionReason.HYPIXEL_BLOCKED: {
				const player =
					UserUtil.getPlayer(discordMessage.author) ??
					(
						await this.client.players.model.findCreateFind({
							where: { discordId: discordMessage.author.id },
							defaults: {
								minecraftUuid: SnowflakeUtil.generate(),
								ign: UNKNOWN_IGN,
								inDiscord: true,
							},
						})
					)[0];

				player.addInfraction();

				const { infractions } = player;

				if (infractions >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS')) {
					const MUTE_DURATION = ms(this.client.config.get('CHATBRIDGE_AUTOMUTE_DURATION'), { long: true });

					this.client.log(
						new MessageEmbed()
							.setColor(this.client.config.get('EMBED_RED'))
							.setAuthor({
								name: discordMessage.author.tag,
								iconURL: (discordMessage.member ?? discordMessage.author).displayAvatarURL({ dynamic: true }),
								url: player.url,
							})
							.setThumbnail((await player.imageURL)!)
							.setDescription(
								stripIndents`
									${Formatters.bold('Auto Muted')} for ${MUTE_DURATION} due to ${infractions} infractions in the last ${ms(
									this.client.config.get('INFRACTIONS_EXPIRATION_TIME'),
									{ long: true },
								)}
									${player.info}
								`,
							)
							.setTimestamp(),
					);

					info = `you were automatically muted for ${MUTE_DURATION} due to continues infractions`;
				}

				info ??= 'continuing to do so will result in an automatic temporary mute';
			}
			// fallthrough

			case ForwardRejectionReason.LOCAL_BLOCKED:
				info = stripIndents`
					your message was blocked because you used a blocked word or character
					(the blocked words filter is to comply with hypixel's chat rules, removing it would simply result in a "We blocked your comment as it breaks our rules"-message)

					${info ?? ''}
				`;
				break;

			case ForwardRejectionReason.MESSAGE_COUNT:
				info = stripIndents`
					your message was blocked because you are only allowed to send up to ${
						data?.maxParts ?? this.client.config.get('CHATBRIDGE_DEFAULT_MAX_PARTS')
					} messages at once
					(in game chat messages can only be up to 256 characters long and new lines are treated as new messages)
				`;
				break;

			default: {
				const never: never = reason;
				throw new Error(`invalid rejection case '${never}'`);
			}
		}

		if (
			reason !== ForwardRejectionReason.HYPIXEL_BLOCKED &&
			(await cache.get(`chatbridge:blocked:dm:${discordMessage.author.id}`))
		)
			return;

		UserUtil.sendDM(discordMessage.author, info);
		logger.info(`[FORWARD REJECTION]: DMed ${discordMessage.author.tag}`);
		cache.set(`chatbridge:blocked:dm:${discordMessage.author.id}`, true, hours(24)); // prevent DMing again in the next 24 hours
	}

	/**
	 * removes line formatters from the beginning and end
	 * @param messages
	 */
	static #cleanCommandResponse(messages: HypixelMessage[]) {
		return messages.map(({ content }) => content.replace(/^-{29,}|-{29,}$/g, '').trim()).join('\n');
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
	async #createBot(): Promise<MinecraftBot> {
		++this.loginAttempts;

		return ((this as MinecraftChatManager<true>).bot = await createBot(this.chatBridge, {
			host: process.env.MINECRAFT_SERVER_HOST,
			port: Number(process.env.MINECRAFT_SERVER_PORT),
			username: process.env.MINECRAFT_USERNAME!.split(/ +/)[this.mcAccount],
			password: process.env.MINECRAFT_PASSWORD!.split(/ +/)[this.mcAccount],
			version: MC_CLIENT_VERSION,
			auth: process.env.MINECRAFT_ACCOUNT_TYPE!.split(/ +/)[this.mcAccount] as 'mojang' | 'microsoft',
		}));
	}

	/**
	 * create and log the bot into hypixel
	 */
	async connect() {
		if (!this.shouldReconnect) {
			throw new Error(`[CHATBRIDGE]: unable to connect #${this.mcAccount} due to a critical error`);
		}

		if (this.isReady()) {
			logger.info(`[CHATBRIDGE]: ${this.logInfo}: already connected`);
			return this;
		}

		await this.#createBot();

		// reconnect the bot if it hasn't successfully spawned in 60 seconds
		if (!this.isReady()) {
			this.abortLoginTimeout = setTimeout(() => {
				logger.warn('[CHATBRIDGE ABORT TIMER]: login abort triggered');
				this.reconnect(0);
			}, seconds(60));
		}

		return this;
	}

	/**
	 * reconnects the bot, exponential login delay up to 10 min
	 * @param loginDelay delay in ms
	 */
	async reconnect(loginDelay = Math.min(seconds(Math.exp(this.loginAttempts)), minutes(10))) {
		if (this.#reconnectPromise) return this.#reconnectPromise;

		try {
			return await (this.#reconnectPromise = this.#reconnect(loginDelay));
		} finally {
			this.#reconnectPromise = null;
		}
	}
	/**
	 * should only ever be called from within reconnect()
	 * @internal
	 */
	async #reconnect(loginDelay: number) {
		this.disconnect();

		logger.warn(`[CHATBRIDGE RECONNECT]: attempting reconnect in ${ms(loginDelay, { long: true })}`);

		await sleep(loginDelay);
		await this.connect();

		return this;
	}

	/**
	 * disconnects the bot
	 */
	disconnect() {
		clearTimeout(this.#reconnectTimeout!);
		this.#reconnectTimeout = null;

		clearTimeout(this.abortLoginTimeout!);
		this.abortLoginTimeout = null;

		this.botReady = false;

		try {
			this.bot?.end('disconnect.quitting');
		} catch (error) {
			logger.error(error, '[CHATBRIDGE DISCONNECT]');
		}

		(this as MinecraftChatManager<false>).bot = null;

		return this;
	}

	/**
	 * @param value
	 */
	#resolveAndReset(value: FilterPromise) {
		this.#resolve(value);
		this.#resetFilter();
		this.#promise = new Promise((res) => (this.#resolve = res));
	}

	/**
	 * @param hypixelMessage
	 */
	collect(hypixelMessage: HypixelMessage) {
		if (!this.#collecting) return;
		if (hypixelMessage.me && hypixelMessage.content.includes(this.#contentFilter!)) {
			return this.#resolveAndReset(hypixelMessage);
		}
		if (hypixelMessage.type) return;
		if (hypixelMessage.spam) return this.#resolveAndReset(ChatResponse.SPAM);
		if (hypixelMessage.content.startsWith('We blocked your comment')) {
			return this.#resolveAndReset(ChatResponse.BLOCKED);
		}
	}

	/**
	 * returns a Promise that resolves with a message that ends with the provided content
	 * @param content
	 */
	#listenFor(content: string) {
		this.#contentFilter = content;
		this.#collecting = true;
		return this.#promise;
	}

	/**
	 * resets the listener filter
	 */
	#resetFilter() {
		this.#contentFilter = null;
		this.#collecting = false;
	}

	/**
	 * increments messageCounter for 10 seconds
	 */
	#tempIncrementCounter() {
		setTimeout(() => --this.#messageCounter, seconds(10));
		return ++this.#messageCounter;
	}

	/**
	 * collects chat messages from the bot
	 * @param options
	 */
	override createMessageCollector(options?: MessageCollectorOptions) {
		return new MessageCollector(this.chatBridge, options);
	}

	/**
	 * discord markdown -> readable string
	 * @param string
	 * @param discordMessage
	 */
	async parseContent(string: string, discordMessage: Message | null) {
		return cleanFormattedNumber(
			// @mentions
			await asyncReplace(string, /<@!?(\d{17,19})>/g, async (match) => {
				const user = this.client.users.cache.get(match[1]);
				if (user) {
					const player = UserUtil.getPlayer(user) ?? (await this.client.players.fetch({ discordId: user.id }));
					if (player) return `@${player}`;
				}

				const NAME =
					(discordMessage?.guild ?? this.chatBridge.hypixelGuild?.discordGuild)?.members.cache.get(match[1])
						?.displayName ?? user?.username;
				if (NAME) return `@${NAME}`;

				return match[0];
			}),
		)
			.replace(/ {2,}/g, ' ') // mc chat displays multiple whitespace as 1
			.replace(/<a?:(\w{2,32}):\d{17,19}>/g, ':$1:') // custom emojis
			.replace(emojiRegex(), (match) => UNICODE_TO_EMOJI_NAME[match as keyof typeof UNICODE_TO_EMOJI_NAME] ?? match) // default emojis
			.replace(/(?<!\\)\\(?=[^a-z\d\\ \n])/gi, '') // replace escaping \ which are invisible on discord
			.replace(/\\{2,}/g, (match) => {
				// replace \\ with \
				let ret = '';
				for (let i = Math.ceil(match.length / 2); i !== 0; --i) ret += '\\';
				return ret;
			})
			.replaceAll('\u{2022}', '\u{25CF}') // better bullet points: "• -> ●"
			.replaceAll('`', "'") // better single quotes
			.replace(/<#(\d{17,19})>/g, (match, p1) => {
				// channels
				const CHANNEL_NAME = (this.client.channels.cache.get(p1) as GuildChannel)?.name;
				if (CHANNEL_NAME) return `#${CHANNEL_NAME}`;
				return match;
			})
			.replace(/<@&(\d{17,19})>/g, (match, p1) => {
				// roles
				const ROLE_NAME = discordMessage?.guild?.roles.cache.get(p1)?.name;
				if (ROLE_NAME) return `@${ROLE_NAME}`;
				return match;
			})
			.replace(/<t:(-?\d{1,13})(?::([DFRTdft]))?>/g, (match, p1, p2) => {
				// dates
				const date = new Date(seconds(p1));

				if (Number.isNaN(date.getTime())) return match; // invalid date

				switch (
					p2 // https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
				) {
					case Formatters.TimestampStyles.ShortTime:
						return date.toLocaleString('en-GB', {
							hour: '2-digit',
							minute: '2-digit',
							timeZoneName: 'short',
							timeZone: 'UTC',
						});

					case Formatters.TimestampStyles.LongTime:
						return date.toLocaleString('en-GB', {
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
							timeZoneName: 'short',
							timeZone: 'UTC',
						});

					case Formatters.TimestampStyles.ShortDate:
						return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

					case Formatters.TimestampStyles.LongDate:
						return date.toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

					case Formatters.TimestampStyles.ShortDateTime:
						return date.toLocaleString('en-GB', {
							day: '2-digit',
							month: 'long',
							year: 'numeric',
							hour: '2-digit',
							minute: '2-digit',
							timeZoneName: 'short',
							timeZone: 'UTC',
						});

					case Formatters.TimestampStyles.LongDateTime:
						return date.toLocaleString('en-GB', {
							weekday: 'long',
							day: '2-digit',
							month: 'long',
							year: 'numeric',
							hour: '2-digit',
							minute: '2-digit',
							timeZoneName: 'short',
							timeZone: 'UTC',
						});

					case Formatters.TimestampStyles.RelativeTime: {
						const TIME = date.getTime() - Date.now();
						if (TIME > 0) return `in ${ms(Math.abs(TIME), { long: true })}`;
						return `${ms(Math.abs(TIME), { long: true })} ago`;
					}

					default:
						return date.toLocaleString('en-GB', {
							day: '2-digit',
							month: 'long',
							year: 'numeric',
							hour: '2-digit',
							minute: '2-digit',
							timeZoneName: 'short',
							timeZone: 'UTC',
						});
				}
			});
	}

	/**
	 * send a message to in game guild chat
	 * @param options
	 */
	gchat(options: string | ChatOptions) {
		const { prefix = '', ..._options } = MinecraftChatManager.resolveInput(options);

		if (this.botPlayer?.muted) {
			if (this.client.config.get('CHAT_LOGGING_ENABLED')) {
				logger.debug(
					`[GCHAT]: bot muted for ${ms(this.botPlayer.mutedTill - Date.now(), {
						long: true,
					})}, unable to send '${prefix}${prefix.length ? ' ' : ''}${_options.content}`,
				);
			}

			return false;
		}

		return this.chat({ prefix: `/gc ${prefix}${prefix.length ? ' ' : INVISIBLE_CHARACTERS[0]}`, ..._options });
	}

	/**
	 * send a message to in game guild chat
	 * @param options
	 */
	ochat(options: string | ChatOptions) {
		const { prefix = '', ..._options } = MinecraftChatManager.resolveInput(options);

		return this.chat({ prefix: `/oc ${prefix}${prefix.length ? ' ' : INVISIBLE_CHARACTERS[0]}`, ..._options });
	}

	/**
	 * send a message to in game party chat
	 * @param options
	 */
	pchat(options: string | ChatOptions) {
		const { prefix = '', ..._options } = MinecraftChatManager.resolveInput(options);

		return this.chat({ prefix: `/pc ${prefix}${prefix.length ? ' ' : INVISIBLE_CHARACTERS[0]}`, ..._options });
	}

	/**
	 * resolves content or options to an options object
	 * @param options
	 */
	static resolveInput(options: string | ChatOptions) {
		return typeof options === 'string' ? { content: options } : options;
	}

	/**
	 * splits the message into the max in game chat length, prefixes all parts and sends them
	 * @param options
	 * @returns success - wether all message parts were send
	 */
	async chat(options: string | ChatOptions) {
		const {
			content,
			prefix = '',
			maxParts = this.client.config.get('CHATBRIDGE_DEFAULT_MAX_PARTS'),
			discordMessage = null,
		} = MinecraftChatManager.resolveInput(options);

		if (!content) return false;

		let success = true;

		const contentParts = new Set(
			(await this.parseContent(content, discordMessage))
				.split('\n')
				.flatMap((part) =>
					splitMessage(part, { char: [' ', ''], maxLength: MinecraftChatManager.MAX_MESSAGE_LENGTH - prefix.length }),
				)
				.filter((part) => {
					if (NON_WHITESPACE_REGEXP.test(part)) {
						// filter out white space only parts
						if (ChatManager.BLOCKED_WORDS_REGEXP.test(part) || MEME_REGEXP.test(part)) {
							if (this.client.config.get('CHAT_LOGGING_ENABLED')) logger.warn(`[CHATBRIDGE CHAT]: blocked '${part}'`);
							return (success = false);
						}
						return true;
					}

					// part consists of only whitespace characters -> ignore
					if (this.client.config.get('CHAT_LOGGING_ENABLED') && part) {
						logger.warn(`[CHATBRIDGE CHAT]: ignored '${part}'`);
					}
					return false;
				}),
		);

		if (!success) {
			// messageParts blocked
			this.#handleForwardRejection(discordMessage, ForwardRejectionReason.LOCAL_BLOCKED);
			return false;
		}

		if (!contentParts.size) return false;

		if (contentParts.size > maxParts) {
			this.#handleForwardRejection(discordMessage, ForwardRejectionReason.MESSAGE_COUNT, { maxParts });
			return false;
		}

		// waits between queueing each part to not clog up the queue if someone spams
		for (const part of contentParts) {
			success = (await this.sendToChat({ content: part, prefix, discordMessage, isMessage: true })) && success;
		}

		return success;
	}

	/**
	 * queue a message for the in game chat
	 * @param options
	 */
	async sendToChat(options: string | ChatOptions) {
		const _options = typeof options === 'string' ? { content: options } : options;

		if (_options.discordMessage?.deleted) {
			if (this.client.config.get('CHAT_LOGGING_ENABLED')) {
				logger.warn(`[CHATBRIDGE CHAT]: deleted on discord: '${_options.prefix ?? ''}${_options.content}'`);
			}
			return false;
		}

		await this.queue.wait();

		try {
			await this.#sendToChat(_options);
			return true;
		} catch (error) {
			logger.error(error, '[CHATBRIDGE MC CHAT]');
			return false;
		} finally {
			this.#retries = 0;
			this.queue.shift();
		}
	}

	/**
	 * internal chat method with error listener and retries, should only ever be called from inside 'sendToChat' or 'command'
	 * @param options
	 */
	async #sendToChat({ content, prefix = '', isMessage, discordMessage = null }: SendToChatOptions): Promise<unknown> {
		if (!this.bot || this.bot.ended) return MessageUtil.react(discordMessage, X_EMOJI);

		let message = `${prefix}${content}`;

		const useSpamBypass = isMessage ?? /^\/(?:[acgop]c|msg|w(?:hisper)?|t(?:ell)?) /i.test(message);

		if (useSpamBypass) {
			let index = this.#retries;

			// 1 for each retry + additional if _lastMessages includes curent padding
			while (
				(--index >= 0 || this._lastMessages.check(message)) &&
				message.length + 6 <= MinecraftChatManager.MAX_MESSAGE_LENGTH
			) {
				message += randomPadding();
			}
		}

		message = trim(message, MinecraftChatManager.MAX_MESSAGE_LENGTH);

		// create listener
		const listener = this.#listenFor(content);

		try {
			this.bot.write('chat', { message });
		} catch (error) {
			logger.error(error, '[CHATBRIDGE _SEND TO CHAT]');
			MessageUtil.react(discordMessage, X_EMOJI);

			this.#resetFilter();

			throw error;
		}

		// listen for responses
		const response = await Promise.race([listener, sleep(MinecraftChatManager.SAFE_DELAY, ChatResponse.TIMEOUT)]);

		switch (response) {
			// collector collected nothing, sleep won the race. this happens for all commands which return a "system reply"
			case ChatResponse.TIMEOUT: {
				this.#tempIncrementCounter();
				this.#resetFilter();

				// only throw for chat messages when the bot was not ready yet
				if (discordMessage && !this.isReady()) {
					MessageUtil.react(discordMessage, X_EMOJI);
					logger.error(`timeout while sending '${message}'`);
					throw response;
				}

				if (useSpamBypass) this._lastMessages.add(message);

				return;
			}

			// anti spam failed -> retry
			case ChatResponse.SPAM: {
				this.#tempIncrementCounter();

				// max retries reached
				if (++this.#retries === MinecraftChatManager.MAX_RETRIES) {
					MessageUtil.react(discordMessage, X_EMOJI);
					await sleep(this.#retries * MinecraftChatManager.ANTI_SPAM_DELAY);
					throw `unable to send '${message}', anti spam failed ${MinecraftChatManager.MAX_RETRIES} times`;
				}

				await sleep(this.#retries * MinecraftChatManager.ANTI_SPAM_DELAY);
				return this.#sendToChat({ content, prefix, isMessage, discordMessage }); // retry sending
			}

			// hypixel filter blocked message
			case ChatResponse.BLOCKED: {
				this.#handleForwardRejection(discordMessage, ForwardRejectionReason.HYPIXEL_BLOCKED);
				await sleep(this.delay);
				throw `unable to send '${message}', hypixel's filter blocked it`;
			}

			// message sent successfully
			default: {
				this._lastMessages.add(message); // since listener doesn't collect command responses 'if (useSpamBypass)' is not needed in this case

				await sleep(
					[MESSAGE_TYPES.GUILD, MESSAGE_TYPES.PARTY, MESSAGE_TYPES.OFFICER].includes(response.type as any)
						? this.delay
						: (this.#tempIncrementCounter(), MinecraftChatManager.SAFE_DELAY), // use safe delay for commands and whispers
				);

				return;
			}
		}
	}

	/**
	 * sends a message to in game chat and resolves with the first message.content within 'INGAME_RESPONSE_TIMEOUT' ms that passes the regex filter, also supports a single string as input
	 * @param commandOptions
	 */
	async command(options: string | (CommandOptions & { raw?: false })): Promise<string>;
	async command(options: CommandOptions & { raw: true }): Promise<HypixelMessage[]>;
	async command(options: CommandOptions): Promise<string>;
	async command(options: string | CommandOptions) {
		const {
			command,
			responseRegExp,
			abortRegExp,
			max = -1,
			raw = false,
			timeout = this.client.config.get('INGAME_RESPONSE_TIMEOUT'),
			rejectOnTimeout = false,
			rejectOnAbort = false,
		} = typeof options === 'string' ? ({ command: options } as CommandOptions) : options;
		await this.#commandQueue.wait(); // only have one collector active at a time (prevent collecting messages from other command calls)
		await this.queue.wait(); // only start the collector if the chat queue is free

		const collector = this.createMessageCollector({
			filter: (hypixelMessage) =>
				hypixelMessage.type === null &&
				((responseRegExp?.test(hypixelMessage.content) ?? true) ||
					(abortRegExp?.test(hypixelMessage.content) ?? false) ||
					/^-{29,}/.test(hypixelMessage.content)),
			time: timeout,
		});

		let resolve: (
			value: HypixelMessage | string | HypixelMessage[] | string[] | PromiseLike<HypixelMessage[] | string[]>,
		) => void;
		let reject!: (reason?: unknown) => void;

		const promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});

		// collect message
		collector.on(MessageCollectorEvents.COLLECT, (hypixelMessage) => {
			// message is line separator
			if (/^-{29,}/.test(hypixelMessage.content)) {
				// message starts and ends with a line separator (50+ * '-') but includes non '-' in the middle -> single message response detected
				if (/[^-]-{29,}$/.test(hypixelMessage.content)) return collector.stop();

				collector.collected.pop(); // remove line separator from collected messages
				if (collector.collected.length) collector.stop(); // stop collector if messages before this line separator were already collected
				return;
			}

			// message is not a line separator
			if (collector.collected.length === max) return collector.stop();

			// abortRegExp triggered
			if (abortRegExp?.test(hypixelMessage.content)) return collector.stop('abort');

			// don't collect anti spam messages
			if (hypixelMessage.spam) collector.collected.pop();
		});

		// end collection
		collector.once(MessageCollectorEvents.END, (collected, reason) => {
			this.#commandQueue.shift();

			switch (reason) {
				case 'time':
				case 'disconnect': {
					if (rejectOnTimeout && !collected.length) {
						if (raw) {
							return resolve([
								{ content: `no in game response after ${ms(timeout, { long: true })}` } as HypixelMessage,
							]);
						}
						return reject(`no in game response after ${ms(timeout, { long: true })}`);
					}

					if (raw) return resolve(collected);
					if (collected.length) return resolve(MinecraftChatManager.#cleanCommandResponse(collected));
					return resolve(`no in game response after ${ms(timeout, { long: true })}`);
				}

				case 'error':
					return; // #sendToChat error, promise gets rejected down below

				case 'abort': {
					if (rejectOnAbort) {
						if (raw) return reject(collected);
						return reject(MinecraftChatManager.#cleanCommandResponse(collected));
					}
				}
				// fallthrough

				default:
					if (raw) return resolve(collected);
					return resolve(MinecraftChatManager.#cleanCommandResponse(collected));
			}
		});

		// send command to chat
		(async () => {
			try {
				await this.#sendToChat({
					content: command,
					prefix: command.startsWith('/') ? '' : '/',
					isMessage: false,
				});
			} catch (error) {
				logger.error(error, '[CHATBRIDGE MC COMMAND]');
				reject(error);
				collector.stop('error');
			} finally {
				this.#retries = 0;
				this.queue.shift();
			}
		})();

		return promise;
	}
}
