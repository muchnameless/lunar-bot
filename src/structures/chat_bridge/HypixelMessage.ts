import { regExpEsc } from '@sapphire/utilities';
import loader from 'prismarine-chat';
import { NEVER_MATCHING_REGEXP, NO_PING_EMOJI, UNKNOWN_IGN } from '../../constants';
import { MessageUtil } from '../../util';
import { mojang } from '../../api';
import { logger, seconds, uuidToImgurBustURL } from '../../functions';
import { HypixelMessageAuthor } from './HypixelMessageAuthor';
import {
	INVISIBLE_CHARACTER_REGEXP,
	MC_CLIENT_VERSION,
	MESSAGE_POSITIONS,
	MESSAGE_TYPES,
	spamMessages,
} from './constants';
import type { PlayerInGuild } from '../database/models/Player';
import type { Message as DiscordMessage } from 'discord.js';
import type { ChatMessage as PrismarineChatMessage } from 'prismarine-chat';
import type { BroadcastOptions, ChatBridge, ChatOptions } from './ChatBridge';
import type { ChatPacket } from './bot_events/chat';
import type { BridgeCommand } from '../commands/BridgeCommand';
import type { DualCommand } from '../commands/DualCommand';

export type HypixelMessageType = keyof typeof MESSAGE_TYPES;

type CommandData = {
	name: string | null;
	command: BridgeCommand | DualCommand | null;
	args: string[];
	prefix: string | null;
};

type AwaitConfirmationOptions = Partial<BroadcastOptions> &
	Partial<ChatOptions> & {
		question?: string;
		/** time in milliseconds to wait for a response */
		time?: number;
		errorMessage?: string;
	};

export interface HypixelUserMessage extends HypixelMessage {
	position: 'CHAT';
	type: NonNullable<HypixelMessage['type']>;
	author: NonNullable<HypixelMessage['author']>;
	readonly player: PlayerInGuild;
	spam: false;
	commandData: NonNullable<HypixelMessage['commandData']>;
}

export const ChatMessage = loader(MC_CLIENT_VERSION);

export class HypixelMessage {
	/**
	 * the chat bridge that instantiated the message
	 */
	chatBridge: ChatBridge;
	/**
	 * the prismarine-parsed message
	 */
	prismarineMessage: PrismarineChatMessage;
	/**
	 * in game message position
	 */
	position: typeof MESSAGE_POSITIONS[keyof typeof MESSAGE_POSITIONS];
	/**
	 * forwarded message
	 */
	discordMessage: Promise<DiscordMessage | null> = Promise.resolve(null);
	/**
	 * raw content string
	 */
	rawContent: string;
	/**
	 * content with invis chars removed
	 */
	cleanedContent: string;
	/**
	 * message type
	 */
	declare type: HypixelMessageType | null;
	declare author: HypixelMessageAuthor | null;
	content: string;
	spam: boolean;
	declare commandData: CommandData | null;

	/**
	 * @param chatBridge
	 * @param packet
	 */
	constructor(chatBridge: ChatBridge, { message, position }: ChatPacket) {
		this.chatBridge = chatBridge;
		this.prismarineMessage = ChatMessage.fromNotch(message);
		this.position = MESSAGE_POSITIONS[position] ?? null;
		this.rawContent = this.prismarineMessage.toString();
		this.cleanedContent = this.rawContent.replace(INVISIBLE_CHARACTER_REGEXP, '').trim();

		/**
		 * Guild > [HypixelRank] ign [GuildRank]: message
		 * Party > [HypixelRank] ign [GuildRank]: message
		 * Officer > [HypixelRank] ign [GuildRank]: message
		 * From [HypixelRank] ign: message
		 */
		const matched = this.cleanedContent.match(
			/^(?:(?<type>Guild|Officer|Party) > |(?<whisper>From|To) )(?:\[.+?\] )?(?<ign>\w+)(?: \[(?<guildRank>\w+)\])?: /,
		);

		if (matched) {
			this.type =
				(matched.groups!.type?.toUpperCase() as HypixelMessageType) ??
				(matched.groups!.whisper ? MESSAGE_TYPES.WHISPER : null);
			this.author = new HypixelMessageAuthor(
				this.chatBridge,
				matched.groups!.whisper !== 'To'
					? {
							ign: matched.groups!.ign,
							guildRank: matched.groups!.guildRank,
							uuid: matched.groups!.type
								? // clickEvent: { action: 'run_command', value: '/viewprofile 2144e244-7653-4635-8245-a63d8b276786' }
								  // @ts-expect-error
								  (this.prismarineMessage.extra?.[0]?.clickEvent?.value as string)
										.slice('/viewprofile '.length)
										.replaceAll('-', '')
								: null,
					  }
					: {
							ign: this.chatBridge.bot?.username ?? UNKNOWN_IGN,
							guildRank: null,
							uuid: this.chatBridge.minecraft.botUuid,
					  },
			);
			this.content = this.cleanedContent.slice(matched[0].length).trimStart();
			this.spam = false;

			// message was sent from the bot -> don't parse input
			if (this.me) {
				this.commandData = null;
				return;
			}

			const prefixMatched =
				new RegExp(
					`^(?:${[
						...this.client.config.get('PREFIXES').map((x) => regExpEsc(x)), // prefixes
						`@${this.chatBridge.bot?.username ?? NEVER_MATCHING_REGEXP}`, // @Bot-IGN
					].join('|')})`,
					'i',
				).exec(this.content)?.[0] ?? null; // PREFIXES, @mention

			const args: string[] = this.content // command arguments
				.slice(prefixMatched?.length ?? 0)
				.trim()
				.split(/ +/);
			const COMMAND_NAME = args.shift(); // extract first word

			// no command, only ping or prefix
			this.commandData =
				(!prefixMatched && this.type !== MESSAGE_TYPES.WHISPER) || !COMMAND_NAME
					? {
							name: null,
							command: null,
							args,
							prefix: null,
					  }
					: {
							name: COMMAND_NAME,
							command: this.client.chatBridges.commands.getByName(COMMAND_NAME.toLowerCase()),
							args,
							prefix: prefixMatched,
					  };
		} else {
			this.type = null;
			this.author = null;
			this.content = this.cleanedContent;
			this.spam = spamMessages.test(this.content);
			this.commandData = null;
		}
	}

	get logInfo() {
		return this.author?.ign ?? 'unknown author';
	}

	get prefixReplacedContent() {
		return this.commandData?.command
			? this.content
					.replace(this.commandData.prefix!, '/')
					.replace(this.commandData.name!, this.commandData.command.name)
			: this.content;
	}

	/**
	 * discord client that instantiated the chatBridge
	 */
	get client() {
		return this.chatBridge.client;
	}

	/**
	 * wether the message was sent by the bot
	 */
	get me() {
		return this.author?.ign === this.chatBridge.bot?.username ?? '@';
	}

	/**
	 * the message author's player object
	 */
	get player() {
		return this.author?.player ?? null;
	}

	/**
	 * the message author's guild object, if the message was sent in guild chat
	 */
	get hypixelGuild() {
		return this.chatBridge.hypixelGuild ?? this.player?.hypixelGuild ?? null;
	}

	/**
	 * content with minecraft formatting codes
	 */
	get formattedContent() {
		return this.prismarineMessage.toMotd().trim();
	}

	/**
	 * to make methods for dc messages compatible with mc messages
	 */
	get member() {
		return this.author?.member ?? null;
	}

	/**
	 * wether the message was sent by a non-bot user
	 */
	isUserMessage(): this is HypixelUserMessage {
		return this.type !== null && !this.me;
	}

	/**
	 * fetch all missing data
	 */
	async init() {
		await this.author?.init();
		return this;
	}

	/**
	 * replies in game (and on discord if guild chat) to the message
	 * @param options
	 */
	async reply(
		options: string | ChatOptions | (BroadcastOptions & ChatOptions),
	): Promise<boolean | [boolean, DiscordMessage | null]> {
		const { ephemeral = false, ..._options } =
			typeof options === 'string' ? ({ content: options } as ChatOptions | (BroadcastOptions & ChatOptions)) : options;

		// to be compatible to Interactions
		if (ephemeral) {
			return this.author!.send({
				maxParts: Number.POSITIVE_INFINITY,
				..._options,
			});
		}

		switch (this.type) {
			case MESSAGE_TYPES.GUILD:
			case MESSAGE_TYPES.OFFICER: {
				const result = await this.chatBridge.broadcast({
					hypixelMessage: this,
					discord: {
						allowedMentions: { parse: [] },
					},
					..._options,
				});

				// DM author the message if sending to gchat failed
				if (!result[0]) {
					this.author!.send(`an error occurred while replying in ${this.type} chat\n${_options.content ?? ''}`);
				}

				return result;
			}

			case MESSAGE_TYPES.PARTY:
				return this.chatBridge.minecraft.pchat({
					maxParts: Number.POSITIVE_INFINITY,
					..._options,
				});

			case MESSAGE_TYPES.WHISPER:
				return this.author!.send({
					maxParts: Number.POSITIVE_INFINITY,
					..._options,
				});

			default:
				throw new Error(`unknown type to reply to: ${this.type}: ${this.rawContent}`);
		}
	}

	/**
	 * forwards the message to discord via the chatBridge's webhook, if the guild has the chatBridge enabled
	 */
	async forwardToDiscord() {
		const discordChatManager = this.chatBridge.discord.channelsByType.get(this.type ?? MESSAGE_TYPES.GUILD);

		if (!discordChatManager) return null;

		try {
			if (this.author) {
				const { player, member } = this;
				const discordMessage = await (this.discordMessage = discordChatManager.sendViaWebhook({
					content: this.prefixReplacedContent,
					username: member?.displayName ?? player?.ign ?? this.author.ign,
					avatarURL:
						member?.displayAvatarURL({ dynamic: true }) ??
						(await player?.imageURL) ??
						(await mojang.ign(this.author.ign).then(
							({ uuid }) => uuidToImgurBustURL(this.client, uuid),
							(error) => logger.error(error, '[FORWARD TO DC]'),
						)) ??
						(member?.guild.me ?? this.client.user)?.displayAvatarURL({ dynamic: true }),
					allowedMentions: {
						parse: player?.hasDiscordPingPermission ? ['users'] : [],
					},
				}));

				// inform user if user and role pings don't actually ping (can't use message.mentions to detect cause that is empty)
				if (/<@&\d{17,19}>/.test(discordMessage.content)) {
					this.author.send('you do not have permission to ping roles from in game chat');
					MessageUtil.react(discordMessage, NO_PING_EMOJI);
				} else if (!player?.hasDiscordPingPermission && /<@!?\d{17,19}>/.test(discordMessage.content)) {
					this.author.send('you do not have permission to ping users from in game chat');
					MessageUtil.react(discordMessage, NO_PING_EMOJI);
				}

				return discordMessage;
			}

			return (this.discordMessage = discordChatManager.sendViaBot({
				content: this.content,
				allowedMentions: { parse: [] },
			}));
		} catch (error) {
			logger.error(error, '[FORWARD TO DC]');
			return null;
		}
	}

	/**
	 * confirms the action via a button collector
	 * @param options
	 */
	async awaitConfirmation(options: string | AwaitConfirmationOptions = {}) {
		const {
			question = 'confirm this action?',
			time = seconds(60),
			errorMessage = 'the command has been cancelled',
			..._options
		} = typeof options === 'string' ? ({ question: options } as AwaitConfirmationOptions) : options;

		this.reply({
			content: question,
			..._options,
		});

		const result = await this.chatBridge.minecraft.awaitMessages({
			filter: (hypixelMessage) => hypixelMessage.author?.ign === this.author!.ign,
			max: 1,
			time,
		});

		if (!this.client.config.get('REPLY_CONFIRMATION').includes(result[0]?.content.toLowerCase())) {
			throw errorMessage;
		}
	}
}
