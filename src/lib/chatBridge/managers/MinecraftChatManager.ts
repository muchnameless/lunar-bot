import { env } from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { AsyncQueue } from '@sapphire/async-queue';
import { TwemojiRegex } from '@sapphire/discord-utilities';
import { jaroWinkler } from '@skyra/jaro-winkler';
import { stripIndents } from 'common-tags';
import {
	bold,
	EmbedBuilder,
	SnowflakeUtil,
	TimestampStyles,
	type GuildChannel,
	type Message,
	type Snowflake,
} from 'discord.js';
import minecraftData from 'minecraft-data';
import { type Client as MinecraftBot } from 'minecraft-protocol';
import ms from 'ms';
import { type HypixelMessage } from '../HypixelMessage.js';
import {
	HypixelMessageCollector,
	HypixelMessageCollectorEvent,
	type HypixelMessageCollectorOptions,
} from '../HypixelMessageCollector.js';
import { createBot } from '../MinecraftBot.js';
import {
	ChatPrefix,
	DELETED_MESSAGE_REASON,
	HypixelMessageType,
	INVISIBLE_CHARACTER_REGEXP,
	randomPadding,
	UNICODE_TO_EMOJI_NAME,
	WHITESPACE_ONLY_REGEXP,
} from '../constants/index.js';
import { ChatManager } from './ChatManager.js';
import { MC_CLIENT_VERSION, UnicodeEmoji, UNKNOWN_IGN } from '#constants';
import {
	assertNever,
	asyncReplace,
	cleanFormattedNumber,
	days,
	minutes,
	replaceSmallLatinCapitalLetters,
	seconds,
	splitMessage,
	trim,
} from '#functions';
import { logger } from '#logger';
import { type Player } from '#structures/database/models/Player.js';
import { MessageUtil, UserUtil } from '#utils';

export interface MinecraftChatOptions {
	content: string;
	discordMessage?: Message | null;
	/**
	 * whether to whisper to the author
	 */
	ephemeral?: boolean;
	maxParts?: number;
	prefix?: string;
	signal?: AbortSignal | null;
}

export interface CommandOptions {
	/**
	 * regex to detect an abortion response
	 */
	abortRegExp?: RegExp | null;
	/**
	 * can also directly be used as the only parameter
	 */
	command: string;
	/**
	 * maximum amount of response messages, -1 or Number.POSITIVE_INFINITY for an infinite amount
	 */
	max?: number;
	/**
	 * command prefix, defaults to '/'
	 */
	prefix?: string;
	/**
	 * whether to return an array of the collected hypixel message objects instead of just the content
	 */
	raw?: boolean;
	/**
	 * whether to reject the promise if the abortRegExp triggered
	 */
	rejectOnAbort?: boolean;
	/**
	 * whether to reject the promise if the collected amount is less than max
	 */
	rejectOnTimeout?: boolean;
	/**
	 * regex to use as a filter for the message collector
	 */
	responseRegExp?: RegExp | null;
	/**
	 * AbortSignal to abort the command
	 */
	signal?: AbortSignal;
	/**
	 * response collector timeout in milliseconds
	 */
	timeout?: number;
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
	private static readonly MAX_INDEX = 4 as const;

	/**
	 * treshold above which the message to send gets additional random padding
	 */
	private static readonly JARO_WINKLER_THRESHOLD = 0.98 as const;

	/**
	 * time in ms after which the cached entry is no longer checked
	 */
	private static readonly EXPIRATION_TIME = minutes(4);

	/**
	 * current buffer index
	 */
	private _index = -1;

	/**
	 * ring buffer
	 */
	private readonly _cache: { message: string; timestamp: number }[] = [];

	public constructor() {
		for (let index = 0; index < LastMessages.MAX_INDEX; ++index) {
			this._cache.push({ message: '', timestamp: Number.POSITIVE_INFINITY });
		}
	}

	/**
	 * removes parts of the content which hypixel's spam filter ignores
	 *
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
	 *
	 * @param content
	 * @param retry
	 */
	public check(content: string, retry: number) {
		const CLEANED_CONTENT = LastMessages._cleanContent(content);
		const THRESHOLD = LastMessages.JARO_WINKLER_THRESHOLD - 0.01 * retry;
		const EXPIRE_TIMESTAMP = Date.now() - LastMessages.EXPIRATION_TIME;

		for (const { message, timestamp } of this._cache) {
			// expired
			if (timestamp < EXPIRE_TIMESTAMP) continue;

			if (
				// exact match
				message === CLEANED_CONTENT ||
				// fuzzy match
				(CLEANED_CONTENT.length > 7 && jaroWinkler(CLEANED_CONTENT, message) >= THRESHOLD)
			) {
				return true;
			}
		}

		return false;
	}

	/**
	 * add the content to the buffer
	 *
	 * @param content
	 */
	public add(content: string) {
		// increment ring buffer index, reset cycle if max index
		if (++this._index === this._cache.length) this._index = 0;

		this._cache[this._index] = { message: LastMessages._cleanContent(content), timestamp: Date.now() };
	}
}

export interface ReadyMinecraftChatManager extends MinecraftChatManager {
	bot: MinecraftBot;
	botUuid: string;
}

export const enum MinecraftChatManagerState {
	Ready,
	Connecting,
	Errored,
}

export class MinecraftChatManager extends ChatManager {
	/**
	 * resolves this._promise
	 */
	private _resolve!: (value: FilterPromise) => void;

	/**
	 * filter promise
	 */
	// eslint-disable-next-line unicorn/consistent-function-scoping
	private _promise: Promise<FilterPromise> = new Promise((resolve) => {
		this._resolve = resolve;
	});

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
	public readonly commandQueue = new AsyncQueue();

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
	public bot: MinecraftBot | null = null;

	/**
	 * minecraft uuid of the bot user
	 */
	public botUuid: string | null = null;

	/**
	 * minecraft IGN of the bot user
	 */
	public botUsername: string | null = null;

	/**
	 * increases each login, reset to 0 on successfull spawn
	 */
	public loginAttempts = 0;

	/**
	 * the state of the minecraft bot
	 */
	public state = MinecraftChatManagerState.Connecting;

	/**
	 * whether the minecraft bot is logged in and ready to receive and send chat messages
	 */
	public isReady(): this is ReadyMinecraftChatManager {
		return this.state === MinecraftChatManagerState.Ready && !(this.bot?.ended ?? true);
	}

	/**
	 * bot player db object
	 */
	public get botPlayer() {
		return (this._botPlayer ??= this.client.players.cache.get(this.botUuid!) ?? null);
	}

	public set botPlayer(value) {
		this._botPlayer = value;
	}

	/**
	 * hypixel server which the minecraft bot is on
	 */
	public get server() {
		return (async () => {
			try {
				const result = await this.command({
					command: 'locraw',
					responseRegExp: /^{.+}$/s,
					rejectOnTimeout: true,
					max: 1,
				});

				return (JSON.parse(result).server as string | undefined) ?? null;
			} catch (error) {
				logger.error({ err: error, ...this.logInfo }, '[GET SERVER]');
				return null;
			}
		})();
	}

	/**
	 * maximum attempts to resend to in-game chat
	 */
	public static readonly MAX_RETRIES = 3 as const;

	/**
	 * normal delay to listen for error messages
	 */
	public static readonly delays = [null, 100, 100, 100, 120, 150, 600] as const;

	/**
	 * delay which can be used to send messages to in-game chat continously
	 */
	public static readonly SAFE_DELAY = 600 as const;

	/**
	 * delay which can be used after triggering anti spam
	 */
	public static readonly ANTI_SPAM_DELAY = seconds(1);

	/**
	 * 100 pre 1.10.2, 256 post 1.10.2
	 */
	// @ts-expect-error supportFeature missing in typings
	public static readonly MAX_MESSAGE_LENGTH = minecraftData(MC_CLIENT_VERSION).supportFeature('lessCharsInChat')
		? (100 as const)
		: (256 as const);

	/**
	 * removes line formatters from the beginning and end
	 *
	 * @param messages
	 */
	public static cleanCommandResponse(messages: HypixelMessage[]) {
		return messages.map(({ content }) => content.replace(/^-{29,}|-{29,}$/g, '').trim()).join('\n');
	}

	/**
	 * resolves content or options to an options object
	 *
	 * @param options
	 */
	public static resolveChatInput(options: MinecraftChatOptions | string) {
		return typeof options === 'string' ? { content: options } : options;
	}

	/**
	 * increasing delay
	 */
	public get delay() {
		return MinecraftChatManager.delays[this._tempIncrementCounter()] ?? MinecraftChatManager.SAFE_DELAY;
	}

	/**
	 * whether the minecraft bot can send chat messages
	 */
	public async isChatReady() {
		if (!this.bot || this.bot.ended) return false;

		try {
			// TODO: this appears to be broken, you can now msg yourself...
			// try to whisper to the bot itself since the bot is both online and the response from the server is always the same
			await this.command({
				command: `w ${this.bot.username} o/`,
				responseRegExp: /^You cannot message this player\.$/,
				timeout: seconds(1),
				rejectOnTimeout: true,
				max: 1,
			});

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * reacts to the message and DMs the author
	 *
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
				assertNever(reason);
		}

		void (this.chatBridge.discord.channelsByIds.get(discordMessage.channelId) ?? UserUtil).sendDM(
			discordMessage.author,
			reason === ForwardRejectionReason.HypixelBlocked
				? { content }
				: {
						content,
						redisKey: `dm:${discordMessage.author.id}:chatbridge:blocked`,
						cooldown: days(1),
				  },
		);
	}

	/**
	 * clears and nullifies the abort login timeout
	 */
	public clearAbortLoginTimeout() {
		clearTimeout(this._abortLoginTimeout!);

		this._abortLoginTimeout = null;
	}

	/**
	 * reconnect the bot if it hasn't successfully spawned in 60 seconds
	 *
	 * @param timeout
	 */
	public scheduleAbortLoginTimeout(timeout = minutes(1)) {
		clearTimeout(this._abortLoginTimeout!);

		this._abortLoginTimeout = setTimeout(() => {
			logger.warn({ ...this.logInfo, timeout }, '[CHATBRIDGE ABORT LOGIN]: triggered -> reconnecting');
			this.reconnect(0).catch((error) =>
				logger.error({ err: error, ...this.logInfo, timeout }, '[CHATBRIDGE ABORT LOGIN]'),
			);
		}, timeout);
	}

	/**
	 * create and log the bot into hypixel
	 */
	public async connect() {
		if (this.state === MinecraftChatManagerState.Errored) {
			throw new Error(`[CHATBRIDGE]: unable to connect #${this.mcAccount} due to a critical error`);
		}

		if (this.isReady()) {
			logger.info(this.logInfo, '[CHATBRIDGE]: already connected');
			return this;
		}

		this.scheduleAbortLoginTimeout();

		++this.loginAttempts;

		this.bot = await createBot(this.chatBridge, {
			host: 'mc.hypixel.net',
			port: 25_565,
			username: env.MINECRAFT_USERNAME.split(/\s+/, this.mcAccount + 1)[this.mcAccount]!,
			password: env.MINECRAFT_PASSWORD.split(/\s+/, this.mcAccount + 1)[this.mcAccount],
			version: MC_CLIENT_VERSION,
			auth: env.MINECRAFT_ACCOUNT_TYPE.split(/\s+/, this.mcAccount + 1)[this.mcAccount] as 'microsoft' | 'mojang',
		});

		return this;
	}

	/**
	 * reconnects the bot, exponential login delay up to 10 min
	 *
	 * @param loginDelay delay in ms
	 */
	public async reconnect(loginDelay = Math.min(seconds(Math.exp(this.loginAttempts)), minutes(10))) {
		this.disconnect();

		logger.warn({ ...this.logInfo, loginDelay }, '[CHATBRIDGE RECONNECT]: attempting reconnect after loginDelay');

		await sleep(loginDelay);
		await this.connect();

		return this;
	}

	/**
	 * disconnects the bot
	 */
	public disconnect() {
		this.clearAbortLoginTimeout();

		if (this.state !== MinecraftChatManagerState.Errored) {
			this.state = MinecraftChatManagerState.Connecting;
		}

		try {
			this.bot?.end('disconnect.quitting');
		} catch (error) {
			logger.error({ err: error, ...this.logInfo }, '[CHATBRIDGE DISCONNECT]');
		}

		this.bot = null;

		return this;
	}

	/**
	 * @param value
	 */
	private _resolveAndReset(value: FilterPromise) {
		this._resolve(value);
		this._resetFilter();
		this._promise = new Promise((resolve) => {
			this._resolve = resolve;
		});
	}

	/**
	 * @param hypixelMessage
	 */
	public collect(hypixelMessage: HypixelMessage) {
		// collector not running
		if (!this._collecting) return;

		// message from the bot including the content that's being waited for
		if (hypixelMessage.me && hypixelMessage.content.includes(this._contentFilter!)) {
			this._resolveAndReset(hypixelMessage);
			return;
		}

		// ignore messages from players
		if (hypixelMessage.type) return;

		// anti-spam response
		if (hypixelMessage.spam) {
			this._resolveAndReset(ChatResponse.Spam);
			return;
		}

		// blocked response
		if (
			// response to blocked words
			hypixelMessage.content.startsWith('We blocked your comment') ||
			// response to urls
			hypixelMessage.content.startsWith('Advertising is against the rules') ||
			// response to anything matching /\${.*}/
			hypixelMessage.content.startsWith('This message is not allowed')
		) {
			this._resolveAndReset(ChatResponse.Blocked);
		}
	}

	/**
	 * returns a Promise that resolves with a message that ends with the provided content
	 *
	 * @param content
	 */
	private async _listenFor(content: string) {
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
	 *
	 * @param options
	 */
	public override createMessageCollector(options?: HypixelMessageCollectorOptions) {
		return new HypixelMessageCollector(this.chatBridge, options);
	}

	/**
	 * discord markdown -> readable string
	 *
	 * @param string
	 * @param discordMessage
	 */
	public async parseContent(string: string, discordMessage: Message | null) {
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
				.replace(INVISIBLE_CHARACTER_REGEXP, '') // hypixel removes them -> remove them here so the filter works reliably
				.replace(/<a?:(\w{2,32}):\d{17,20}>/g, ':$1:') // custom emojis
				.replace(TwemojiRegex, (match) => UNICODE_TO_EMOJI_NAME[match as keyof typeof UNICODE_TO_EMOJI_NAME] ?? match) // default (unicode) emojis
				// replace escaping \ which are invisible on discord, '¯\_' is ignored since it's part of '¯\_(ツ)_/¯' which doesn't need to be escaped
				.replace(/(?<![\\¯])\\(?=[^\d\n \\a-z])/gi, '')
				.replace(/\\{2,}/g, (match) => {
					// replace \\ with \
					let ret = '';
					for (let index = Math.ceil(match.length / 2); index !== 0; --index) {
						ret += '\\';
					}

					return ret;
				})
				.replaceAll('\u{2022}', '\u{25CF}') // better bullet points: "• -> ●"
				.replaceAll('`', "'") // better single quotes
				.replace(/<(#|@&)(\d{17,20})>/g, (match, type: '@&' | '#', id: Snowflake) => {
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

						default:
							return match;
					}
				})
				// application command mentions
				.replace(/<(\/[\w-]{1,32}(?: [\w-]{1,32}){0,2}):\d{17,20}>/g, (_, name: string) => name)
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

						// case TimestampStyles.ShortDateTime:
						// 	return date.toLocaleString('en-GB', {
						// 		day: '2-digit',
						// 		month: 'long',
						// 		year: 'numeric',
						// 		hour: '2-digit',
						// 		minute: '2-digit',
						// 		timeZoneName: 'short',
						// 		timeZone: 'UTC',
						// 	});

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
					// hideLinkEmbed markdown
					/<(https?:\/\/(?:www\.)?[\w#%+.:=@~-]{2,256}\.[a-z]{2,6}\b[\w#%&+./:=?@~-]*)>/gi,
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
	 *
	 * @param options
	 */
	public async gchat(options: MinecraftChatOptions | string) {
		const { prefix, ..._options } = MinecraftChatManager.resolveChatInput(options);

		if (this.hypixelGuild?.checkMute(this.botPlayer)) {
			logger.trace(
				{
					prefix,
					content: _options.content,
					mutedFor: this.hypixelGuild.mutedPlayers.get(this.botUuid!)! - Date.now(),
				},
				'[GCHAT]: bot muted',
			);

			return false;
		}

		return this.chat({ prefix: prefix ? `${ChatPrefix.Guild}${prefix} ` : ChatPrefix.Guild, ..._options });
	}

	/**
	 * send a message to in-game guild chat
	 *
	 * @param options
	 */
	public async ochat(options: MinecraftChatOptions | string) {
		const { prefix, ..._options } = MinecraftChatManager.resolveChatInput(options);

		if (this.hypixelGuild?.checkMute(this.botPlayer)) {
			logger.trace(
				{
					prefix,
					content: _options.content,
					mutedFor: this.hypixelGuild.mutedPlayers.get(this.botUuid!)! - Date.now(),
				},
				'[OCHAT]: bot muted',
			);

			return false;
		}

		return this.chat({ prefix: prefix ? `${ChatPrefix.Officer}${prefix} ` : ChatPrefix.Officer, ..._options });
	}

	/**
	 * send a message to in-game party chat
	 *
	 * @param options
	 */
	public async pchat(options: MinecraftChatOptions | string) {
		const { prefix, ..._options } = MinecraftChatManager.resolveChatInput(options);

		return this.chat({ prefix: prefix ? `${ChatPrefix.Party}${prefix} ` : ChatPrefix.Party, ..._options });
	}

	/**
	 * whisper a message to another player
	 *
	 * @param ign
	 * @param options
	 */
	public async whisper(ign: string, options: MinecraftChatOptions | string) {
		const { prefix, ..._options } = MinecraftChatManager.resolveChatInput(options);

		return this.chat({
			prefix: prefix ? `${ChatPrefix.Whisper}${ign} ${prefix} ` : `${ChatPrefix.Whisper}${ign} `,
			maxParts: Number.POSITIVE_INFINITY,
			..._options,
		});
	}

	/**
	 * splits the message into the max in-game chat length, prefixes all parts and sends them
	 *
	 * @param options
	 * @returns success - whether all message parts were send
	 */
	public async chat(options: MinecraftChatOptions | string) {
		const {
			content,
			prefix = '',
			maxParts = this.client.config.get('CHATBRIDGE_DEFAULT_MAX_PARTS'),
			discordMessage = null,
			signal,
		} = MinecraftChatManager.resolveChatInput(options);

		if (!content) return false;

		const parsedContent = await this.parseContent(content, discordMessage);

		// filter check
		if (MinecraftChatManager.shouldBlock(parsedContent)) {
			logger.warn({ prefix, content, parsedContent }, '[CHATBRIDGE CHAT]: blocked word or URL');
			void this._handleForwardRejection(discordMessage, ForwardRejectionReason.LocalBlocked);
			return false;
		}

		// use a set to deduplicate the parts
		const contentParts = new Set<string>();

		// split message into lines and each line into parts which don't exceed the maximum allowed length
		for (const line of parsedContent.split('\n')) {
			for (const part of splitMessage(line, {
				char: [' ', ''],
				maxLength: MinecraftChatManager.MAX_MESSAGE_LENGTH - prefix.length,
			})) {
				// filter out whitespace only parts
				if (WHITESPACE_ONLY_REGEXP.test(part)) {
					if (part) {
						logger.trace({ prefix, content, parsedContent, part }, '[CHATBRIDGE CHAT]: ignored whitespace part');
					}

					continue;
				}

				contentParts.add(part);
			}
		}

		if (!contentParts.size) return false;

		if (contentParts.size > maxParts) {
			void this._handleForwardRejection(discordMessage, ForwardRejectionReason.MessageCount, { maxParts });
			return false;
		}

		let lastMessages: LastMessages | null;
		let commandPrefix: string;
		let contentPrefix: string;

		if (prefix.startsWith(ChatPrefix.Guild) || prefix.startsWith(ChatPrefix.Officer)) {
			// guild and officer chat
			lastMessages = this._lastMessages[LastMessagesType.Guild]!;

			commandPrefix = prefix.slice(0, ChatPrefix.Guild.length);
			contentPrefix = prefix.slice(ChatPrefix.Guild.length);
		} else if (prefix.startsWith(ChatPrefix.Whisper)) {
			// whispers
			lastMessages = this._lastMessages[LastMessagesType.Whisper]!;

			const index = prefix.indexOf(' ', ChatPrefix.Whisper.length) + 1;
			commandPrefix = prefix.slice(0, index);
			contentPrefix = prefix.slice(index);
		} else {
			// unknown prefix
			lastMessages = null;

			commandPrefix = prefix;
			contentPrefix = '';
		}

		let success = true;

		// waits between queueing each part to not clog up the queue if someone spams
		for (const part of contentParts) {
			// queue and catch AbortSignal abortions, abort already shifts the queue
			try {
				await this.queue.wait({ signal });
			} catch (error) {
				logger.error({ err: error, ...this.logInfo }, '[CHATBRIDGE CHAT]');
				return signal!.reason === DELETED_MESSAGE_REASON; // do not try to react with :x: if the message was deleted
			}

			try {
				await this.#sendToChat(`${contentPrefix}${part}`, commandPrefix, discordMessage, lastMessages);
			} catch (error) {
				logger.error({ err: error, ...this.logInfo }, '[CHATBRIDGE CHAT]');
				success = false;
			} finally {
				this._retries = 0;
				this.queue.shift();
			}
		}

		return success;
	}

	/**
	 * internal chat method with error listener and retries, should only ever be called from inside 'chat' or 'command'
	 *
	 * @param content
	 * @param prefix
	 * @param discordMessage
	 * @param lastMessages
	 * @internal
	 */
	async #sendToChat(
		content: string,
		prefix: string,
		discordMessage: Message | null = null,
		lastMessages: LastMessages | null = null,
	): Promise<void> {
		if (!this.bot || this.bot.ended) {
			void MessageUtil.react(discordMessage, UnicodeEmoji.X);
			return;
		}

		// anti-spam has to happen here since this function is recursive
		if (lastMessages) {
			let index = this._retries;

			// 1 for each retry + additional if lastMessages includes curent padding
			while (
				(--index >= 0 || lastMessages.check(content, this._retries)) &&
				prefix.length + content.length <= MinecraftChatManager.MAX_MESSAGE_LENGTH
			) {
				// eslint-disable-next-line no-param-reassign
				content += randomPadding();
			}
		}

		const message = trim(`${prefix}${content}`, MinecraftChatManager.MAX_MESSAGE_LENGTH);

		// create listener
		const listener = this._listenFor(content);

		try {
			const timestamp = BigInt(Date.now());

			this.bot.write('chat_message', {
				message,
				timestamp,
				salt: 0,
				signature: this.bot.signMessage(message, timestamp),
			});
		} catch (error) {
			logger.error({ err: error, ...this.logInfo }, '[_SEND TO CHAT]: bot.write error');
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
					throw `timeout while sending '${message}'`;
				}

				lastMessages?.add(content);
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
				return this.#sendToChat(content, prefix, discordMessage, lastMessages); // retry sending
			}

			// hypixel filter blocked message
			case ChatResponse.Blocked: {
				void this._handleForwardRejection(discordMessage, ForwardRejectionReason.HypixelBlocked);
				await sleep(this.delay);
				throw `unable to send '${message}', hypixel's filter blocked it`;
			}

			// message sent successfully
			default: {
				lastMessages!.add(content); // listener doesn't collect command responses -> lastMessages is always defined

				await sleep(
					[HypixelMessageType.Guild, HypixelMessageType.Party, HypixelMessageType.Officer].includes(response.type!)
						? this.delay
						: (this._tempIncrementCounter(), MinecraftChatManager.SAFE_DELAY), // use safe delay for commands and whispers
				);
			}
		}
	}

	/**
	 * sends a message to in-game chat and resolves with the first message.content within 'INGAME_RESPONSE_TIMEOUT' ms that passes the regex filter, also supports a single string as input
	 *
	 * @param options
	 */
	public async command(options: CommandOptions & { raw: true }): Promise<HypixelMessage[]>;
	public async command(options: CommandOptions | string): Promise<string>;
	public async command(options: CommandOptions | string) {
		const {
			command,
			prefix = command.startsWith('/') ? '' : '/',
			responseRegExp,
			abortRegExp = /^Unknown command. Type "help" for help\.$/,
			max = -1,
			raw = false,
			timeout = this.client.config.get('INGAME_RESPONSE_TIMEOUT'),
			rejectOnTimeout = false,
			rejectOnAbort = false,
			signal,
		} = typeof options === 'string' ? ({ command: options } as CommandOptions) : options;

		// only have one collector active at a time (prevent collecting messages from other command calls)
		await this.commandQueue.wait({ signal });

		// only start the collector if the chat queue is free
		try {
			await this.queue.wait({ signal });
		} catch (error) {
			this.commandQueue.shift();
			throw error;
		}

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
				if (/[^-]-{29,}$/.test(hypixelMessage.content)) {
					// remove all other collected messages
					if (collector.collected.length !== 1) collector.collected = [hypixelMessage];
					collector.stop();
					return;
				}

				collector.collected.pop(); // remove line separator from collected messages
				if (collector.collected.length) collector.stop(); // stop collector if messages before this line separator were already collected
				return;
			}

			// message is not a line separator
			if (collector.collected.length === max) {
				collector.stop();
				return;
			}

			// abortRegExp triggered
			if (abortRegExp?.test(hypixelMessage.content)) {
				collector.stop('abort');
				return;
			}

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
								resolve([{ content: `no in-game response after ${ms(timeout, { long: true })}` } as HypixelMessage]);
								return;
							}

							reject(`no in-game response after ${ms(timeout, { long: true })}`);
							return;
						}

						if (raw) {
							resolve(collected);
							return;
						}

						if (collected.length) {
							resolve(MinecraftChatManager.cleanCommandResponse(collected));
							return;
						}

						resolve(`no in-game response after ${ms(timeout, { long: true })}`);
						return;
					}

					case 'error':
						return; // _sendToChat error, promise gets rejected down below

					case 'abort': {
						if (rejectOnAbort) {
							if (raw) {
								reject(collected);
								return;
							}

							reject(MinecraftChatManager.cleanCommandResponse(collected));
							return;
						}
					}
					// fallthrough

					default:
						if (raw) {
							resolve(collected);
							return;
						}

						resolve(MinecraftChatManager.cleanCommandResponse(collected));
				}
			});

			// send command to chat
			try {
				await this.#sendToChat(command, prefix);
			} catch (error) {
				logger.error({ err: error, ...this.logInfo }, '[CHATBRIDGE COMMAND]');
				reject(error);
				collector.stop('error');
			} finally {
				this._retries = 0;
				this.queue.shift();
			}
		});
	}
}
