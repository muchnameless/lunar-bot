import { setTimeout as sleep } from 'node:timers/promises';
import { setTimeout, clearTimeout } from 'node:timers';
import { URL } from 'node:url';
import { env } from 'node:process';
import { bold, EmbedBuilder, SnowflakeUtil, TimestampStyles } from 'discord.js';
import { AsyncQueue } from '@sapphire/async-queue';
import { stripIndents } from 'common-tags';
import minecraftData from 'minecraft-data';
import ms from 'ms';
import { TwemojiRegex } from '@sapphire/discord-utilities';
import { jaroWinkler } from '@skyra/jaro-winkler';
import { MessageUtil, UserUtil } from '#utils';
import { logger } from '#logger';
import { MC_CLIENT_VERSION, UnicodeEmoji, UNKNOWN_IGN } from '#constants';
import {
	assertNever,
	asyncReplace,
	cleanFormattedNumber,
	hours,
	minutes,
	replaceSmallLatinCapitalLetters,
	seconds,
	splitMessage,
	trim,
} from '#functions';
import {
	HypixelMessageType,
	INVISIBLE_CHARACTER_REGEXP,
	INVISIBLE_CHARACTERS,
	MEME_REGEXP,
	MinecraftChatManagerState,
	NON_WHITESPACE_REGEXP,
	randomPadding,
	UNICODE_TO_EMOJI_NAME,
} from '../constants';
import { createBot } from '../MinecraftBot';
import { HypixelMessageCollector, HypixelMessageCollectorEvent } from '../HypixelMessageCollector';
import { ChatManager } from './ChatManager';
import type { GuildChannel, Message, Snowflake } from 'discord.js';
import type { Client as MinecraftBot } from 'minecraft-protocol';
import type { HypixelMessageCollectorOptions } from '../HypixelMessageCollector';
import type { Player } from '#structures/database/models/Player';
import type { HypixelMessage } from '../HypixelMessage';
import type { If } from '#types';
import type { ChatOptions } from '../ChatBridge';

export interface SendToChatOptions {
	content: string;
	prefix?: string;
	discordMessage?: Message | null;
	/** whether to whisper to the author */
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
	/** whether to return an array of the collected hypixel message objects instead of just the content */
	raw?: boolean;
	/** response collector timeout in milliseconds */
	timeout?: number;
	/** whether to reject the promise if the collected amount is less than max */
	rejectOnTimeout?: boolean;
	/** whether to reject the promise if the abortRegExp triggered */
	rejectOnAbort?: boolean;
}

type FilterPromise = ChatResponse | HypixelMessage;

const enum ChatResponse {
	Timeout,
	Spam,
	Blocked,
}

const enum ForwardRejectionReason {
	HypixelBlocked,
	LocalBlocked,
	MessageCount,
}

const enum LastMessagesType {
	Guild,
	Whisper,
}

class LastMessages {
	/**
	 * buffer size
	 */
	private static MAX_INDEX = 4 as const;
	/**
	 * treshold above which the message to send gets additional random padding
	 */
	private static JARO_WINKLER_THRESHOLD = 0.985 as const;

	/**
	 * current buffer index
	 */
	private index = -1;
	/**
	 * ring buffer
	 */
	private cache: string[] = [];

	constructor() {
		for (let i = 0; i < LastMessages.MAX_INDEX; ++i) {
			this.cache.push('');
		}
	}

	/**
	 * removes parts of the content which hypixel's spam filter ignores
	 * @param content
	 */
	private static _cleanContent(content: string) {
		return content
			.replace(/\d/g, '') // remove numbers
			.replace(/(?<=^\/)o(?=c)/, 'g') // oc and gc share the same anti spam bucket -> /oc -> /gc
			.replace(INVISIBLE_CHARACTER_REGEXP, '') // remove invis chars
			.trim() // remove whitespaces at the beginning and end
			.replace(/ {2,}/g, ' '); // mc messages can only have single spaces
	}

	/**
	 * check whether the content is already in the buffer
	 * @param content
	 * @param retry
	 */
	check(content: string, retry: number) {
		const CLEANED_CONTENT = LastMessages._cleanContent(content);
		const THRESHOLD = LastMessages.JARO_WINKLER_THRESHOLD - 0.005 * retry;

		return this.cache.some((cached) => {
			// exact match
			if (cached === CLEANED_CONTENT) return true;
			if (CLEANED_CONTENT.length <= 7) return false;
			// fuzzy match
			return jaroWinkler(CLEANED_CONTENT, cached) >= THRESHOLD;
		});
	}

	/**
	 * add the content to the buffer
	 * @param content
	 */
	add(content: string) {
		// increment ring buffer index, reset cycle if max index
		if (++this.index === LastMessages.MAX_INDEX) this.index = 0;

		this.cache[this.index] = LastMessages._cleanContent(content);
	}
}

export class MinecraftChatManager<loggedIn extends boolean = boolean> extends ChatManager {
	/**
	 * resolves this._promise
	 */
	private _resolve!: (value: FilterPromise) => void;
	/**
	 * filter promise
	 */
	private _promise: Promise<FilterPromise> = new Promise((res) => (this._resolve = res));
	/**
	 * bot player db object
	 */
	private _botPlayer: Player | null = null;
	/**
	 * filter for the message listener
	 */
	private _contentFilter: string | null = null;
	/**
	 * whether the message sent collector is active
	 */
	private _collecting = false;
	/**
	 * current retry when resending messages
	 */
	private _retries = 0;
	/**
	 * how many messages have been sent to in-game chat in the last 10 seconds
	 */
	private _messageCounter = 0;
	/**
	 * async queue for minecraft commands, prevents multiple response collectors
	 */
	private commandQueue = new AsyncQueue();
	/**
	 * timeout to disconnect the bot if it hasn't successfully spawned and connected in 60 seconds
	 */
	private _abortLoginTimeout: NodeJS.Timeout | null = null;
	/**
	 * anti spam checker
	 */
	private _lastMessages = [new LastMessages(), new LastMessages()];
	/**
	 * minecraft bot client
	 */
	bot: If<loggedIn, MinecraftBot> = null as If<loggedIn, MinecraftBot>;
	/**
	 * minecraft uuid of the bot user
	 */
	botUuid: If<loggedIn, string> = null as If<loggedIn, string>;
	/**
	 * increases each login, reset to 0 on successfull spawn
	 */
	loginAttempts = 0;
	/**
	 * the state of the minecraft bot
	 */
	state = MinecraftChatManagerState.Connecting;

	/**
	 * whether the minecraft bot is logged in and ready to receive and send chat messages
	 */
	isReady(): this is MinecraftChatManager<true> {
		return this.state === MinecraftChatManagerState.Ready && !(this.bot?.ended ?? true);
	}

	/**
	 * bot player db object
	 */
	get botPlayer() {
		return (this._botPlayer ??= this.client.players.cache.get(this.botUuid!) ?? null);
	}
	set botPlayer(value) {
		this._botPlayer = value;
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
	 * whether the minecraft bot can send chat messages
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
	 * maximum attempts to resend to in-game chat
	 */
	static MAX_RETRIES = 3 as const;

	/**
	 * normal delay to listen for error messages
	 */
	static delays = [null, 100, 100, 100, 120, 150, 600] as const;

	/**
	 * delay which can be used to send messages to in-game chat continously
	 */
	static SAFE_DELAY = 600 as const;

	/**
	 * delay which can be used after triggering anti spam
	 */
	static ANTI_SPAM_DELAY = seconds(1);

	/**
	 * 100 pre 1.10.2, 256 post 1.10.2
	 */
	// @ts-expect-error supportFeature missing in typings
	static MAX_MESSAGE_LENGTH = minecraftData(MC_CLIENT_VERSION).supportFeature('lessCharsInChat')
		? (100 as const)
		: (256 as const);

	/**
	 * reacts to the message and DMs the author
	 * @param discordMessage
	 * @param reason
	 * @param data
	 */
	private async _handleForwardRejection(
		discordMessage: Message | null,
		reason: ForwardRejectionReason,
		data?: Record<string, unknown>,
	) {
		if (!discordMessage) return;

		void MessageUtil.react(discordMessage, UnicodeEmoji.Stop);

		let content: string | undefined;

		switch (reason) {
			case ForwardRejectionReason.HypixelBlocked: {
				const player =
					UserUtil.getPlayer(discordMessage.author) ??
					(
						await this.client.players.model.findCreateFind({
							where: { discordId: discordMessage.author.id },
							defaults: {
								minecraftUuid: SnowflakeUtil.generate().toString(),
								ign: UNKNOWN_IGN,
								inDiscord: true,
							},
						})
					)[0];

				void player.addInfraction();

				const { infractions } = player;

				if (infractions >= this.client.config.get('CHATBRIDGE_AUTOMUTE_MAX_INFRACTIONS')) {
					const MUTE_DURATION = ms(this.client.config.get('CHATBRIDGE_AUTOMUTE_DURATION'), { long: true });

					void this.client.log(
						new EmbedBuilder()
							.setColor(this.client.config.get('EMBED_RED'))
							.setAuthor({
								name: discordMessage.author.tag,
								iconURL: (discordMessage.member ?? discordMessage.author).displayAvatarURL(),
								url: player.url,
							})
							.setThumbnail(player.imageURL)
							.setDescription(
								stripIndents`
									${bold('Auto Muted')} for ${MUTE_DURATION} due to ${infractions} infractions
									${player.info}
								`,
							)
							.setTimestamp(),
					);

					content = `you were automatically muted for ${MUTE_DURATION} due to continues infractions`;
				}

				content ??= 'continuing to do so will result in an automatic temporary mute';
			}
			// fallthrough

			case ForwardRejectionReason.LocalBlocked:
				content = stripIndents`
					your message was blocked because you used a blocked word or character
					(the blocked words filter is to comply with hypixel's chat rules, removing it would simply result in a "We blocked your comment as it breaks our rules"-message)

					${content ?? ''}
				`;
				break;

			case ForwardRejectionReason.MessageCount:
				content = stripIndents`
					your message was blocked because you are only allowed to send up to ${
						data?.maxParts ?? this.client.config.get('CHATBRIDGE_DEFAULT_MAX_PARTS')
					} messages at once
					(in-game chat messages can only be up to 256 characters long and new lines are treated as new messages)
				`;
				break;

			default:
				return assertNever(reason);
		}

		void UserUtil.sendDM(
			discordMessage.author,
			reason === ForwardRejectionReason.HypixelBlocked
				? content
				: {
						content,
						redisKey: `dm:${discordMessage.author.id}:chatbridge:blocked`,
						cooldown: hours(24),
				  },
		);
	}

	/**
	 * removes line formatters from the beginning and end
	 * @param messages
	 */
	static cleanCommandResponse(messages: HypixelMessage[]) {
		return messages.map(({ content }) => content.replace(/^-{29,}|-{29,}$/g, '').trim()).join('\n');
	}

	/**
	 * increasing delay
	 */
	get delay() {
		return MinecraftChatManager.delays[this._tempIncrementCounter()] ?? MinecraftChatManager.SAFE_DELAY;
	}

	/**
	 * clears and nullifies the abort login timeout
	 */
	clearAbortLoginTimeout() {
		clearTimeout(this._abortLoginTimeout!);

		this._abortLoginTimeout = null;
	}

	/**
	 * reconnect the bot if it hasn't successfully spawned in 60 seconds
	 * @param time
	 */
	scheduleAbortLoginTimeout(time = seconds(60)) {
		clearTimeout(this._abortLoginTimeout!);

		this._abortLoginTimeout = setTimeout(() => {
			logger.warn(`[CHATBRIDGE ABORT LOGIN]: triggered after ${ms(time, { long: true })} -> reconnecting`);
			this.reconnect(0).catch((error) => logger.error(error, '[CHATBRIDGE ABORT LOGIN]'));
		}, time);
	}

	/**
	 * create and log the bot into hypixel
	 */
	async connect() {
		if (this.state === MinecraftChatManagerState.Errored) {
			throw new Error(`[CHATBRIDGE]: unable to connect #${this.mcAccount} due to a critical error`);
		}

		if (this.isReady()) {
			logger.info(`[CHATBRIDGE]: ${this.logInfo}: already connected`);
			return this;
		}

		this.scheduleAbortLoginTimeout();

		++this.loginAttempts;

		(this as MinecraftChatManager<true>).bot = await createBot(this.chatBridge, {
			host: env.MINECRAFT_SERVER_HOST,
			port: Number(env.MINECRAFT_SERVER_PORT),
			username: env.MINECRAFT_USERNAME!.split(/\s+/, this.mcAccount + 1)[this.mcAccount]!,
			password: env.MINECRAFT_PASSWORD!.split(/\s+/, this.mcAccount + 1)[this.mcAccount],
			version: MC_CLIENT_VERSION,
			auth: env.MINECRAFT_ACCOUNT_TYPE!.split(/\s+/, this.mcAccount + 1)[this.mcAccount] as 'mojang' | 'microsoft',
		});

		return this;
	}

	/**
	 * reconnects the bot, exponential login delay up to 10 min
	 * @param loginDelay delay in ms
	 */
	async reconnect(loginDelay = Math.min(seconds(Math.exp(this.loginAttempts)), minutes(10))) {
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
		this.clearAbortLoginTimeout();

		if (this.state !== MinecraftChatManagerState.Errored) {
			this.state = MinecraftChatManagerState.Connecting;
		}

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
	private _resolveAndReset(value: FilterPromise) {
		this._resolve(value);
		this._resetFilter();
		this._promise = new Promise((res) => (this._resolve = res));
	}

	/**
	 * @param hypixelMessage
	 */
	collect(hypixelMessage: HypixelMessage) {
		if (!this._collecting) return;
		if (hypixelMessage.me && hypixelMessage.content.includes(this._contentFilter!)) {
			return this._resolveAndReset(hypixelMessage);
		}
		if (hypixelMessage.type) return;
		if (hypixelMessage.spam) return this._resolveAndReset(ChatResponse.Spam);
		if (hypixelMessage.content.startsWith('We blocked your comment')) {
			return this._resolveAndReset(ChatResponse.Blocked);
		}
	}

	/**
	 * returns a Promise that resolves with a message that ends with the provided content
	 * @param content
	 */
	private _listenFor(content: string) {
		this._contentFilter = content;
		this._collecting = true;
		return this._promise;
	}

	/**
	 * resets the listener filter
	 */
	private _resetFilter() {
		this._contentFilter = null;
		this._collecting = false;
	}

	/**
	 * increments messageCounter for 10 seconds
	 */
	private _tempIncrementCounter() {
		setTimeout(() => --this._messageCounter, seconds(10));
		return ++this._messageCounter;
	}

	/**
	 * collects chat messages from the bot
	 * @param options
	 */
	override createMessageCollector(options?: HypixelMessageCollectorOptions) {
		return new HypixelMessageCollector(this.chatBridge, options);
	}

	/**
	 * discord markdown -> readable string
	 * @param string
	 * @param discordMessage
	 */
	async parseContent(string: string, discordMessage: Message | null) {
		return (
			cleanFormattedNumber(
				// @mentions
				await asyncReplace(string, /<@!?(\d{17,20})>/g, async (match) => {
					const user = this.client.users.cache.get(match[1]!);
					if (user) {
						const player = UserUtil.getPlayer(user) ?? (await this.client.players.fetch({ discordId: user.id }));
						if (player) return `@${player}`;
					}

					const NAME =
						(discordMessage?.guild ?? this.chatBridge.hypixelGuild?.discordGuild)?.members.cache.get(match[1]!)
							?.displayName ?? user?.username;
					if (NAME) return `@${NAME}`;

					return match[0]!;
				}),
			)
				.replace(/ {2,}/g, ' ') // mc chat displays multiple whitespace as 1
				.replace(/<a?:(\w{2,32}):\d{17,20}>/g, ':$1:') // custom emojis
				.replace(TwemojiRegex, (match) => UNICODE_TO_EMOJI_NAME[match as keyof typeof UNICODE_TO_EMOJI_NAME] ?? match) // default (unicode) emojis
				// replace escaping \ which are invisible on discord, '¯\_' is ignored since it's part of '¯\_(ツ)_/¯' which doesn't need to be escaped
				.replace(/(?<![¯\\])\\(?=[^a-z\d\\ \n])/gi, '')
				.replace(/\\{2,}/g, (match) => {
					// replace \\ with \
					let ret = '';
					for (let i = Math.ceil(match.length / 2); i !== 0; --i) ret += '\\';
					return ret;
				})
				.replaceAll('\u{2022}', '\u{25CF}') // better bullet points: "• -> ●"
				.replaceAll('`', "'") // better single quotes
				.replace(/<(#|@&)(\d{17,20})>/g, (match, type: '#' | '@&', id: Snowflake) => {
					switch (type) {
						// channels
						case '#': {
							const CHANNEL_NAME = (this.client.channels.cache.get(id) as GuildChannel)?.name;
							if (CHANNEL_NAME) return `#${replaceSmallLatinCapitalLetters(CHANNEL_NAME)}`;
							return match;
						}

						// roles
						case '@&': {
							const ROLE_NAME = discordMessage?.guild?.roles.cache.get(id)?.name;
							if (ROLE_NAME) return `@${ROLE_NAME}`;
							return match;
						}
					}
				})
				// application command mentions
				.replace(/<(\/[-\w]{1,32}(?: [-\w]{1,32})?(?: [-\w]{1,32})?):\d{17,20}>/g, (_, name: string) => name)
				.replace(/<t:(-?\d{1,13})(?::([DFRTdft]))?>/g, (match, p1: string, p2: string) => {
					// dates
					const date = new Date(seconds(Number(p1)));

					if (Number.isNaN(date.getTime())) return match; // invalid date

					// https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
					switch (p2) {
						case TimestampStyles.ShortTime:
							return date.toLocaleString('en-GB', {
								hour: '2-digit',
								minute: '2-digit',
								timeZoneName: 'short',
								timeZone: 'UTC',
							});

						case TimestampStyles.LongTime:
							return date.toLocaleString('en-GB', {
								hour: '2-digit',
								minute: '2-digit',
								second: '2-digit',
								timeZoneName: 'short',
								timeZone: 'UTC',
							});

						case TimestampStyles.ShortDate:
							return date.toLocaleString('en-GB', {
								day: '2-digit',
								month: '2-digit',
								year: 'numeric',
								timeZone: 'UTC',
							});

						case TimestampStyles.LongDate:
							return date.toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

						case TimestampStyles.ShortDateTime:
							return date.toLocaleString('en-GB', {
								day: '2-digit',
								month: 'long',
								year: 'numeric',
								hour: '2-digit',
								minute: '2-digit',
								timeZoneName: 'short',
								timeZone: 'UTC',
							});

						case TimestampStyles.LongDateTime:
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

						case TimestampStyles.RelativeTime: {
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
				})
				.replace(
					// hideEmbedLink markdown
					/<(https?:\/\/(?:www\.)?[-\w@:%.+~#=]{2,256}\.[a-z]{2,6}\b[-\w@:%+.~#?&/=]*)>/gi,
					(match, p1: string) => {
						// return p1 if it is a valid URL
						try {
							new URL(p1);
							return p1;
						} catch {
							return match;
						}
					},
				)
		);
	}

	/**
	 * send a message to in-game guild chat
	 * @param options
	 */
	gchat(options: string | ChatOptions) {
		const { prefix = '', ..._options } = MinecraftChatManager.resolveInput(options);

		if (this.hypixelGuild?.checkMute(this.botPlayer)) {
			logger.trace(
				`[GCHAT]: bot muted for ${ms(this.hypixelGuild.mutedPlayers.get(this.botUuid!)! - Date.now(), {
					long: true,
				})}, unable to send '${prefix}${prefix.length ? ' ' : ''}${_options.content}`,
			);

			return false;
		}

		return this.chat({ prefix: `/gc ${prefix}${prefix.length ? ' ' : INVISIBLE_CHARACTERS[0]}`, ..._options });
	}

	/**
	 * send a message to in-game guild chat
	 * @param options
	 */
	ochat(options: string | ChatOptions) {
		const { prefix = '', ..._options } = MinecraftChatManager.resolveInput(options);

		return this.chat({ prefix: `/oc ${prefix}${prefix.length ? ' ' : INVISIBLE_CHARACTERS[0]}`, ..._options });
	}

	/**
	 * send a message to in-game party chat
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
	 * splits the message into the max in-game chat length, prefixes all parts and sends them
	 * @param options
	 * @returns success - whether all message parts were send
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
							logger.warn(`[CHATBRIDGE CHAT]: blocked '${part}'`);
							return (success = false);
						}
						return true;
					}

					// part consists of only whitespace characters -> ignore
					if (part) logger.trace(`[CHATBRIDGE CHAT]: ignored '${part}'`);

					return false;
				}),
		);

		if (!success) {
			// messageParts blocked
			void this._handleForwardRejection(discordMessage, ForwardRejectionReason.LocalBlocked);
			return false;
		}

		if (!contentParts.size) return false;

		if (contentParts.size > maxParts) {
			void this._handleForwardRejection(discordMessage, ForwardRejectionReason.MessageCount, { maxParts });
			return false;
		}

		// waits between queueing each part to not clog up the queue if someone spams
		for (const part of contentParts) {
			success = (await this.sendToChat({ content: part, prefix, discordMessage })) && success;
		}

		return success;
	}

	/**
	 * queue a message for the in-game chat
	 * @param options
	 */
	async sendToChat(options: string | ChatOptions) {
		const _options = typeof options === 'string' ? { content: options } : options;

		if (_options.discordMessage && MessageUtil.DELETED_MESSAGES.has(_options.discordMessage)) {
			logger.warn(`[CHATBRIDGE CHAT]: deleted on discord: '${_options.prefix ?? ''}${_options.content}'`);
			return false;
		}

		await this.queue.wait();

		try {
			await this._sendToChat(_options);
			return true;
		} catch (error) {
			logger.error(error, '[CHATBRIDGE MC CHAT]');
			return false;
		} finally {
			this._retries = 0;
			this.queue.shift();
		}
	}

	/**
	 * internal chat method with error listener and retries, should only ever be called from inside 'sendToChat' or 'command'
	 * @param options
	 * @internal
	 */
	private async _sendToChat({ content, prefix = '', discordMessage = null }: SendToChatOptions): Promise<unknown> {
		if (!this.bot || this.bot.ended) return MessageUtil.react(discordMessage, UnicodeEmoji.X);

		let message = `${prefix}${content}`;
		let _content: string | undefined;
		let lastMessages: LastMessages | undefined;

		if (message.startsWith('/gc ') || message.startsWith('/oc ')) {
			lastMessages = this._lastMessages[LastMessagesType.Guild];
			_content = message.slice('/gc '.length);
		} else if (message.startsWith('/w ')) {
			lastMessages = this._lastMessages[LastMessagesType.Whisper];
			_content = message.slice(message.indexOf(' ', '/w '.length) + 1);
		}

		if (lastMessages) {
			let index = this._retries;

			// 1 for each retry + additional if _lastMessages includes curent padding
			while (
				(--index >= 0 || lastMessages.check(_content!, this._retries)) &&
				message.length + 6 <= MinecraftChatManager.MAX_MESSAGE_LENGTH
			) {
				message += randomPadding();
			}
		}

		message = trim(message, MinecraftChatManager.MAX_MESSAGE_LENGTH);

		// create listener
		const listener = this._listenFor(content);

		try {
			this.bot.write('chat', { message });
		} catch (error) {
			logger.error(error, '[CHATBRIDGE _SEND TO CHAT]');
			void MessageUtil.react(discordMessage, UnicodeEmoji.X);

			this._resetFilter();

			throw error;
		}

		// listen for responses
		const response = await Promise.race([listener, sleep(MinecraftChatManager.SAFE_DELAY, ChatResponse.Timeout)]);

		switch (response) {
			// collector collected nothing, sleep won the race. this happens for all commands which return a "system reply"
			case ChatResponse.Timeout: {
				this._tempIncrementCounter();
				this._resetFilter();

				// only throw for chat messages when the bot was not ready yet
				if (discordMessage && !this.isReady()) {
					void MessageUtil.react(discordMessage, UnicodeEmoji.X);
					logger.error(`timeout while sending '${message}'`);
					throw response;
				}

				lastMessages?.add(_content!);

				return;
			}

			// anti spam failed -> retry
			case ChatResponse.Spam: {
				this._tempIncrementCounter();

				// max retries reached
				if (++this._retries === MinecraftChatManager.MAX_RETRIES) {
					void MessageUtil.react(discordMessage, UnicodeEmoji.X);
					await sleep(this._retries * MinecraftChatManager.ANTI_SPAM_DELAY);
					throw `unable to send '${message}', anti spam failed ${MinecraftChatManager.MAX_RETRIES} times`;
				}

				await sleep(this._retries * MinecraftChatManager.ANTI_SPAM_DELAY);
				return this._sendToChat({ content, prefix, discordMessage }); // retry sending
			}

			// hypixel filter blocked message
			case ChatResponse.Blocked: {
				void this._handleForwardRejection(discordMessage, ForwardRejectionReason.HypixelBlocked);
				await sleep(this.delay);
				throw `unable to send '${message}', hypixel's filter blocked it`;
			}

			// message sent successfully
			default: {
				lastMessages!.add(_content!); // listener doesn't collect command responses -> lastMessages is always defined

				await sleep(
					[HypixelMessageType.Guild, HypixelMessageType.Party, HypixelMessageType.Officer].includes(response.type!)
						? this.delay
						: (this._tempIncrementCounter(), MinecraftChatManager.SAFE_DELAY), // use safe delay for commands and whispers
				);

				return;
			}
		}
	}

	/**
	 * sends a message to in-game chat and resolves with the first message.content within 'INGAME_RESPONSE_TIMEOUT' ms that passes the regex filter, also supports a single string as input
	 * @param options
	 */
	async command(options: string | (CommandOptions & { raw?: false })): Promise<string>;
	async command(options: CommandOptions & { raw: true }): Promise<HypixelMessage[]>;
	async command(options: CommandOptions): Promise<string>;
	async command(options: string | CommandOptions) {
		const {
			command,
			responseRegExp,
			abortRegExp = /^Unknown command. Type "help" for help\.$/,
			max = -1,
			raw = false,
			timeout = this.client.config.get('INGAME_RESPONSE_TIMEOUT'),
			rejectOnTimeout = false,
			rejectOnAbort = false,
		} = typeof options === 'string' ? ({ command: options } as CommandOptions) : options;
		await this.commandQueue.wait(); // only have one collector active at a time (prevent collecting messages from other command calls)
		await this.queue.wait(); // only start the collector if the chat queue is free

		const collector = this.createMessageCollector({
			filter: (hypixelMessage) =>
				hypixelMessage.type === null &&
				((responseRegExp?.test(hypixelMessage.content) ?? true) ||
					(abortRegExp?.test(hypixelMessage.content) ?? false) ||
					/^-{29,}/.test(hypixelMessage.content)),
			time: timeout,
		});

		// collect message
		collector.on(HypixelMessageCollectorEvent.Collect, (hypixelMessage) => {
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

		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (resolve, reject) => {
			// end collection
			collector.once(HypixelMessageCollectorEvent.End, (collected, reason) => {
				this.commandQueue.shift();

				switch (reason) {
					case 'time':
					case 'disconnect': {
						if (rejectOnTimeout && !collected.length) {
							if (raw) {
								return resolve([
									{ content: `no in-game response after ${ms(timeout, { long: true })}` } as HypixelMessage,
								]);
							}
							return reject(`no in-game response after ${ms(timeout, { long: true })}`);
						}

						if (raw) return resolve(collected);
						if (collected.length) return resolve(MinecraftChatManager.cleanCommandResponse(collected));
						return resolve(`no in-game response after ${ms(timeout, { long: true })}`);
					}

					case 'error':
						return; // _sendToChat error, promise gets rejected down below

					case 'abort': {
						if (rejectOnAbort) {
							if (raw) return reject(collected);
							return reject(MinecraftChatManager.cleanCommandResponse(collected));
						}
					}
					// fallthrough

					default:
						if (raw) return resolve(collected);
						return resolve(MinecraftChatManager.cleanCommandResponse(collected));
				}
			});

			// send command to chat
			try {
				await this._sendToChat({
					content: command,
					prefix: command.startsWith('/') ? '' : '/',
				});
			} catch (error) {
				logger.error(error, '[CHATBRIDGE MC COMMAND]');
				reject(error);
				collector.stop('error');
			} finally {
				this._retries = 0;
				this.queue.shift();
			}
		});
	}
}
