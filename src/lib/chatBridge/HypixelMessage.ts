import { parseArgs, type ParseArgsConfig } from 'node:util';
import { regExpEsc } from '@sapphire/utilities';
import { type GuildMember, type Message as DiscordMessage } from 'discord.js';
import { type ChatMessage as PrismarineChatMessage } from 'prismarine-chat';
import { type BroadcastOptions, type BroadcastResult, type ChatBridge } from './ChatBridge.js';
import { HypixelMessageAuthor } from './HypixelMessageAuthor.js';
import { PrismarineMessage } from './PrismarineMessage.js';
import { type ChatPacket } from './botEvents/player_chat.js';
import { HypixelMessageType, spamMessages, type MessagePosition } from './constants/index.js';
import { type DiscordChatManager } from './managers/DiscordChatManager.js';
import { type MinecraftChatOptions } from './managers/MinecraftChatManager.js';
import { mojang } from '#api';
import { AnsiColour, AnsiFormat, NEVER_MATCHING_REGEXP, UnicodeEmoji, UNKNOWN_IGN } from '#constants';
import { ansiTag, minutes, uuidToBustURL } from '#functions';
import { logger } from '#logger';
import { type BridgeCommand } from '#structures/commands/BridgeCommand.js';
import { type DualCommand } from '#structures/commands/DualCommand.js';
import { type Player } from '#structures/database/models/Player.js';
import { MessageUtil } from '#utils';

type ParseArgsConfigOptions = NonNullable<ParseArgsConfig['options']>;

type CommandData = {
	args: string[];
	command: BridgeCommand | DualCommand | null;
	name: string | null;
	parseArgs<T extends ParseArgsConfigOptions = ParseArgsConfigOptions>(): ReturnType<
		typeof _parseArgsWithOptionsApplied<T>
	>;
	prefix: string | null;
};

const _parseArgsWithOptionsApplied = <T extends ParseArgsConfigOptions>(args: string[], options: T) =>
	parseArgs({ args, options, strict: true, allowPositionals: true });

type AwaitConfirmationOptions = Partial<BroadcastOptions> &
	Partial<MinecraftChatOptions> & {
		errorMessage?: string;
		question?: string;
		/**
		 * time in milliseconds to wait for a response
		 */
		time?: number;
	};

interface ForwardToDiscordOptions {
	discordChatManager: DiscordChatManager;
	member: GuildMember | null;
	player: Player | null;
}

export interface HypixelUserMessage extends HypixelMessage {
	author: NonNullable<HypixelMessage['author']>;
	commandData: CommandData;
	me: false;
	spam: false;
	type: NonNullable<HypixelMessage['type']>;
}

export class HypixelMessage {
	/**
	 * the chat bridge that instantiated the message
	 */
	public readonly chatBridge: ChatBridge;

	/**
	 * the prismarine-parsed message
	 */
	public readonly prismarineMessage: PrismarineChatMessage;

	/**
	 * in-game message position
	 */
	public readonly position: MessagePosition;

	/**
	 * forwarded message
	 */
	public discordMessage: Promise<DiscordMessage | null> = Promise.resolve(null);

	/**
	 * trimmed raw content string
	 */
	public readonly rawContent: string;

	/**
	 * message type
	 */
	public readonly type: HypixelMessageType | null;

	/**
	 * whether the message was sent by the bot
	 */
	public readonly me: boolean = false;

	/**
	 * message author, including db and discord data
	 */
	public readonly author: HypixelMessageAuthor | null;

	/**
	 * content without "Guild > [RANK] IGN: "
	 */
	public readonly content: string;

	/**
	 * whether the message is an anti spam reply from hypixel
	 */
	public readonly spam: boolean;

	/**
	 * command data, including args, used prefix
	 */
	public readonly commandData: CommandData | null;

	/**
	 * @param chatBridge
	 * @param packet
	 */
	public constructor(chatBridge: ChatBridge, { content, type }: ChatPacket) {
		this.chatBridge = chatBridge;
		this.prismarineMessage = PrismarineMessage.fromNotch(content);
		this.position = type;
		this.rawContent = this.prismarineMessage.toString().trim();

		/**
		 * Guild > [HypixelRank] ign [GuildRank]: message
		 * Party > [HypixelRank] ign [GuildRank]: message
		 * Officer > [HypixelRank] ign [GuildRank]: message
		 * From [HypixelRank] ign: message
		 */
		const matched =
			/^(?:(?<type>Guild|Officer|Party) > |(?<whisper>From|To) )(?:\[.+?] )?(?<ign>\w+)(?: \[(?<guildRank>\w+)])?: /.exec(
				this.rawContent,
			);

		if (matched) {
			this.type =
				(matched.groups!.type?.toUpperCase() as HypixelMessageType | undefined) ??
				(matched.groups!.whisper ? HypixelMessageType.Whisper : null);
			this.author = new HypixelMessageAuthor(
				this.chatBridge,
				matched.groups!.whisper === 'To'
					? {
							ign: this.chatBridge.minecraft.botUsername ?? UNKNOWN_IGN,
							guildRank: null,
							uuid: this.chatBridge.minecraft.botUuid,
					  }
					: {
							ign: matched.groups!.ign!,
							guildRank: matched.groups!.guildRank,
							uuid: matched.groups!.type
								? // clickEvent: { action: 'run_command', value: '/viewprofile 2144e244-7653-4635-8245-a63d8b276786' }
								  // @ts-expect-error prismarineMessage typings
								  (this.prismarineMessage.extra?.[0]?.clickEvent?.value as string)
										.slice('/viewprofile '.length)
										.replaceAll('-', '')
								: null,
					  },
			);
			this.content = this.rawContent.slice(matched[0]!.length).trimStart();
			this.spam = false;

			// message was sent from the bot -> don't parse input
			if (this.author.ign === this.chatBridge.minecraft.botUsername) {
				this.me = true;
				this.commandData = null;
				return;
			}

			const prefixMatched =
				new RegExp(
					`^(?:${[
						...this.client.config.get('PREFIXES').map((x) => regExpEsc(x)), // prefixes
						`@${this.chatBridge.minecraft.botUsername ?? NEVER_MATCHING_REGEXP}`, // @Bot-IGN
					].join('|')})`,
					'i',
				).exec(this.content)?.[0] ?? null; // PREFIXES, @mention

			const args = this.content // command arguments
				.slice(prefixMatched?.length ?? 0)
				.trim()
				.split(/ +/);
			const COMMAND_NAME = args.shift(); // extract first word

			// no command, only ping or prefix
			if ((!prefixMatched && this.type !== HypixelMessageType.Whisper) || !COMMAND_NAME) {
				this.commandData = {
					name: null,
					command: null,
					args,
					parseArgs() {
						throw 'unknown command';
					},
					prefix: null,
				};
			} else {
				const command = this.chatBridge.manager.commands.getByName(COMMAND_NAME.toLowerCase());

				this.commandData = {
					name: COMMAND_NAME,
					command,
					args,
					parseArgs: () =>
						parseArgs({
							args,
							options: command?.parseArgsOptions,
							strict: true,
							allowPositionals: true,
						}) as any,
					prefix: prefixMatched,
				};
			}
		} else {
			this.type = null;
			this.author = null;
			this.content = this.rawContent;
			this.spam = spamMessages.test(this.content);
			this.commandData = null;
		}
	}

	/**
	 * !w -> /weight
	 */
	private get prefixReplacedContent() {
		return this.commandData?.command
			? this.content
					.replace(this.commandData.prefix!, '/')
					.replace(this.commandData.name!, this.commandData.command.name)
			: this.content;
	}

	/**
	 * discord client that instantiated the chatBridge
	 */
	public get client() {
		return this.chatBridge.client;
	}

	/**
	 * the message author's player object
	 */
	public get player() {
		return this.author?.player ?? null;
	}

	/**
	 * the message author's guild object, if the message was sent in guild chat
	 */
	public get hypixelGuild() {
		return this.chatBridge.hypixelGuild ?? this.player?.hypixelGuild ?? null;
	}

	/**
	 * content with minecraft formatting codes
	 */
	public get formattedContent() {
		return this.prismarineMessage.toMotd().trim();
	}

	/**
	 * content with discord ansi markdown instead of minecraft formatting codes
	 * correct colours (not all are supported by discord and therefore omitted / replaced with something similar)
	 *
	 * §0 - black         - \u001b[30m
	 * §1 - dark blue     - \u001b[34m
	 * §2 - dark green    - \u001b[32m
	 * §3 - dark aqua     - \u001b[36m
	 * §4 - dark red      - \u001b[31m
	 * §5 - dark purple   - \u001b[35m
	 * §6 - gold          - \u001b[33m
	 * §7 - gray          - \u001b[37m
	 * §8 - dark gray     - \u001b[90m
	 * §9 - blue          - \u001b[94m
	 * §a - green         - \u001b[92m
	 * §b - aqua          - \u001b[96m
	 * §c - red           - \u001b[91m
	 * §d - light purple  - \u001b[95m
	 * §e - yellow        - \u001b[93m
	 * §f - white         - \u001b[97m
	 * §k - obfuscated    - \u001b[6m
	 * §l - bold          - \u001b[1m
	 * §m - strikethrough - \u001b[9m
	 * §n - underline     - \u001b[4m
	 * §o - italic        - \u001b[3m
	 * §r - reset         - \u001b[0m
	 *
	 * @param reset - whether to replace reset tags
	 */
	public ansiContent(reset = true) {
		let message = this.formattedContent;

		message = message.replace(/§([\da-fk-or])/g, (_, code: string) => {
			switch (code) {
				case '0':
				case '7':
				case '8':
					return ansiTag([AnsiColour.Gray]);
				case '1':
				case '9':
					return ansiTag([AnsiColour.Blue]);
				case '2':
				case 'a':
					return ansiTag([AnsiColour.Green]);
				case '3':
				case 'b':
					return ansiTag([AnsiColour.Cyan]);
				case '4':
				case 'c':
					return ansiTag([AnsiColour.Red]);
				case '5':
				case 'd':
					return ansiTag([AnsiColour.Pink]);
				case '6':
				case 'e':
					return ansiTag([AnsiColour.Yellow]);
				case 'f':
					return reset ? ansiTag([AnsiColour.White]) : '';
				case 'l':
					return ansiTag([AnsiFormat.Bold]);
				case 'n':
					return ansiTag([AnsiFormat.Underline]);
				case 'r':
					return reset ? ansiTag() : '';

				default:
					return '';
			}
		});

		return reset ? `${message}${ansiTag()}` : message;
	}

	/**
	 * to make methods for dc messages compatible with mc messages
	 */
	public get member() {
		return this.author?.member ?? null;
	}

	/**
	 * fetch all missing data
	 */
	public async init() {
		await this.author?.init();
		return this;
	}

	/**
	 * replies in-game (and on discord if guild chat) to the message
	 *
	 * @param options
	 */
	public async reply(options: string | (BroadcastOptions & MinecraftChatOptions)) {
		const { ephemeral = false, ..._options } = typeof options === 'string' ? { content: options } : options;

		// to be compatible to Interactions
		if (ephemeral) {
			return this.author!.send(_options);
		}

		switch (this.type) {
			case HypixelMessageType.Guild:
			case HypixelMessageType.Officer: {
				const result: BroadcastResult = await this.chatBridge.broadcast({
					hypixelMessage: this as HypixelMessage & { type: HypixelMessageType.Guild | HypixelMessageType.Officer },
					..._options,
				});

				// DM author the message if sending to gchat failed
				if (!result[0]) {
					void this.author!.send(_options);
				}

				return result;
			}

			case HypixelMessageType.Party:
				return this.chatBridge.minecraft.pchat({
					maxParts: Number.POSITIVE_INFINITY,
					..._options,
				});

			case HypixelMessageType.Whisper:
				return this.author!.send(_options);

			default:
				throw new Error(`unknown type to reply to: ${this.type}: ${this.rawContent}`);
		}
	}

	/**
	 * forwards the message to discord via the chatBridge's webhook, if the guild has the chatBridge enabled
	 */
	public async forwardToDiscord(): Promise<DiscordMessage | null> {
		const discordChatManager = this.chatBridge.discord.channelsByType.get(this.type ?? HypixelMessageType.Guild);
		if (!discordChatManager) return null;

		// server message
		if (!this.author) {
			return (this.discordMessage = discordChatManager.sendViaBot({
				content: this.content,
				fromMinecraft: true,
			}));
		}

		// user message
		try {
			const { player } = this;
			const discordMessage = await (this.discordMessage = this.#forwardToDiscord({
				discordChatManager,
				member: this.member,
				player,
			}));

			// inform user if user and role pings don't actually ping (can't use message.mentions to detect cause that is empty)
			if (/<@&\d{17,20}>/.test(discordMessage.content)) {
				void this.author.send('you do not have permission to ping roles from in-game chat');
				void MessageUtil.react(discordMessage, UnicodeEmoji.NoPing);
			} else if (!player?.hasDiscordPingPermission && /<@!?\d{17,20}>/.test(discordMessage.content)) {
				void this.author.send('you do not have permission to ping users from in-game chat');
				void MessageUtil.react(discordMessage, UnicodeEmoji.NoPing);
			}

			return discordMessage;
		} catch (error) {
			logger.error(error, '[FORWARD TO DISCORD]');
			return null;
		}
	}

	/**
	 * @param options
	 * @internal
	 */
	async #forwardToDiscord({ discordChatManager, player, member }: ForwardToDiscordOptions) {
		const abortController = new AbortController();

		return discordChatManager.sendViaWebhook({
			queuePromise: discordChatManager.queuePromise(abortController.signal),
			abortController,
			content: await this.chatBridge.discord.parseContent(this.prefixReplacedContent, true),
			username: member?.displayName ?? player?.ign ?? this.author!.ign,
			avatarURL:
				member?.displayAvatarURL() ??
				player?.imageURL ??
				(await mojang.ign(this.author!.ign).then(
					({ uuid }) => uuidToBustURL(uuid),
					(error) => logger.error(error, '[FORWARD TO DISCORD]'),
				)) ??
				(member?.guild.members.me ?? this.client.user)?.displayAvatarURL(),
			allowedMentions: {
				parse: player?.hasDiscordPingPermission ? ['users'] : [],
			},
		});
	}

	/**
	 * confirms the action via a button collector
	 *
	 * @param options
	 */
	public async awaitConfirmation(options: AwaitConfirmationOptions | string = {}) {
		const {
			question = 'confirm this action?',
			time = minutes(1),
			errorMessage = 'the command has been cancelled',
			..._options
		} = typeof options === 'string' ? ({ question: options } as AwaitConfirmationOptions) : options;

		await this.reply({
			content: question,
			..._options,
		});

		const result = await this.chatBridge.minecraft.awaitMessages({
			filter: (hypixelMessage) => hypixelMessage.author?.ign === this.author!.ign,
			max: 1,
			time,
		});

		if (!this.client.config.get('REPLY_CONFIRMATION').includes(result[0]?.content.toLowerCase() as string)) {
			throw errorMessage;
		}
	}
}
