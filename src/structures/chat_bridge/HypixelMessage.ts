import loader from 'prismarine-chat';
import { INVISIBLE_CHARACTER_REGEXP, MC_CLIENT_VERSION, MESSAGE_POSITIONS, MESSAGE_TYPES, spamMessages } from './constants';
import { NO_PING_EMOJI } from '../../constants';
import { HypixelMessageAuthor } from './HypixelMessageAuthor';
import { MessageUtil } from '../../util';
import { mojang } from '../../api/mojang';
import { escapeRegex, logger, uuidToImgurBustURL } from '../../functions';
import type { Message } from 'discord.js';
import type { ChatMessage as PrismarineChatMessage } from 'prismarine-chat';
import type { BroadcastOptions, ChatBridge, ChatOptions } from './ChatBridge';
import type { ChatPacket } from './bot_events/chat';
import type { If } from '../../types/util';
import type { BridgeCommand } from '../commands/BridgeCommand';
import type { DualCommand } from '../commands/DualCommand';


export type HypixelMessageType = keyof typeof MESSAGE_TYPES;

type CommandData<UserMessage extends boolean> = If<UserMessage, {
	name: string | null,
	command: BridgeCommand | DualCommand | null,
	args: string[],
	prefix: string | null,
}>;

type AwaitConfirmationOptions = BroadcastOptions | ChatOptions | BroadcastOptions & ChatOptions | { question?: string, timeoutSeconds?: number, errorMessage?: string };


export const ChatMessage = loader(MC_CLIENT_VERSION);

export class HypixelMessage<UserMessage extends boolean = true> {
	chatBridge: ChatBridge;
	prismarineMessage: PrismarineChatMessage;
	position: typeof MESSAGE_POSITIONS[keyof typeof MESSAGE_POSITIONS];
	discordMessage: Promise<Message | null>;
	rawContent: string;
	cleanedContent: string;
	type!: If<UserMessage, HypixelMessageType>;
	author!: If<UserMessage, HypixelMessageAuthor>;
	content: string;
	spam: boolean;
	commandData: CommandData<UserMessage>;

	/**
	 * @param chatBridge
	 * @param packet
	 */
	constructor(chatBridge: ChatBridge, { message, position }: ChatPacket) {
		/**
		 * the chat bridge that instantiated the message
		 */
		this.chatBridge = chatBridge;
		/**
		 * the prismarine-parsed message
		 */
		this.prismarineMessage = ChatMessage.fromNotch(message);
		/**
		 * in game message position
		 */
		this.position = MESSAGE_POSITIONS[position] ?? null;
		/**
		 * forwarded message
		 */
		this.discordMessage = Promise.resolve(null);
		/**
		 * raw content string
		 */
		this.rawContent = this.prismarineMessage.toString();
		/**
		 * content with invis chars removed
		 */
		this.cleanedContent = this.rawContent.replace(INVISIBLE_CHARACTER_REGEXP, '').trim();

		/**
		 * Guild > [HypixelRank] ign [GuildRank]: message
		 * Party > [HypixelRank] ign [GuildRank]: message
		 * Officer > [HypixelRank] ign [GuildRank]: message
		 * From [HypixelRank] ign: message
		 */
		const matched = this.cleanedContent.match(/^(?:(?<type>Guild|Officer|Party) > |(?<whisper>From|To) )(?:\[.+?] )?(?<ign>\w+)(?: \[(?<guildRank>\w+)])?: /);

		if (matched) {
			/**
			 * message type
			 */
			(this as HypixelMessage<true>).type = (matched.groups!.type?.toUpperCase() as HypixelMessageType ?? (matched.groups!.whisper ? MESSAGE_TYPES.WHISPER : null));
			(this as HypixelMessage<true>).author = new HypixelMessageAuthor(
				this.chatBridge,
				matched.groups!.whisper !== 'To'
					? {
						ign: matched.groups!.ign,
						guildRank: matched.groups!.guildRank,
						uuid: matched.groups!.type
							// clickEvent: { action: 'run_command', value: '/viewprofile 2144e244-7653-4635-8245-a63d8b276786' }
							? this.prismarineMessage.extra?.[0].clickEvent?.value.slice('/viewprofile '.length).replaceAll('-', '')
							: null,
					}
					: {
						ign: this.chatBridge.bot!.username,
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

			const prefixMatched = new RegExp(
				`^(?:${[ ...this.client.config.get('PREFIXES').map(x => escapeRegex(x)), `@${this.chatBridge.bot!.username}` ].join('|')})`,
				'i',
			).exec(this.content)?.[0]; // PREFIXES, @mention

			const args: string[] = this.content // command arguments
				.slice(prefixMatched?.length ?? 0)
				.trim()
				.split(/ +/);
			const COMMAND_NAME = args.shift(); // extract first word

			// no command, only ping or prefix
			this.commandData = (!prefixMatched && this.type !== MESSAGE_TYPES.WHISPER) || !COMMAND_NAME
				? {
					name: null,
					command: null,
					args,
					prefix: null,
				} as CommandData<UserMessage> : {
					name: COMMAND_NAME,
					command: this.client.chatBridges.commands.getByName(COMMAND_NAME.toLowerCase()),
					args,
					prefix: prefixMatched,
				} as CommandData<UserMessage>;
		} else {
			this.type = null as If<UserMessage, HypixelMessageType>;
			this.author = null as If<UserMessage, HypixelMessageAuthor>;
			this.content = this.cleanedContent;
			this.spam = spamMessages.test(this.content);
			this.commandData = null as CommandData<UserMessage>;
		}
	}

	get logInfo() {
		return this.author?.ign ?? 'unknown author';
	}

	get prefixReplacedContent() {
		return this.commandData?.command
			? this.content
				.replace(this.commandData.prefix, '/')
				.replace(this.commandData.name, this.commandData.command.name)
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
		return this.author?.ign === this.chatBridge.bot!.username;
	}

	/**
	 * wether the message was sent by a non-bot user
	 */
	get isUserMessage() {
		return Boolean(this.type && !this.me);
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
		return this.author?.member;
	}

	isUserMessageTG(): this is HypixelMessage<true> {
		return this.type !== null && Reflect.has(MESSAGE_TYPES, this.type);
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
	 * @param contentOrOptions
	 */
	async reply(contentOrOptions: string | ChatOptions | BroadcastOptions & ChatOptions) {
		const { ephemeral = false, ...options } = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		// to be compatible to Interactions
		if (ephemeral) return this.author!.send({
			maxParts: Number.POSITIVE_INFINITY,
			...options,
		});

		switch (this.type) {
			case MESSAGE_TYPES.GUILD:
			case MESSAGE_TYPES.OFFICER: {
				const result = await this.chatBridge.broadcast({
					hypixelMessage: this,
					discord: {
						allowedMentions: { parse: [] },
					},
					...options,
				});

				// DM author the message if sending to gchat failed
				if (!result[0]) this.author!.send(`an error occurred while replying in ${this.type} chat\n${options.content ?? ''}`);

				return result;
			}

			case MESSAGE_TYPES.PARTY:
				return this.chatBridge.minecraft.pchat({
					maxParts: Number.POSITIVE_INFINITY,
					...options,
				});

			case MESSAGE_TYPES.WHISPER:
				return this.author!.send({
					maxParts: Number.POSITIVE_INFINITY,
					...options,
				});

			default:
				throw new Error(`unknown type to reply to: ${this.type}: ${this.rawContent}`);
		}
	}

	/**
	 * forwards the message to discord via the chatBridge's webhook, if the guild has the chatBridge enabled
	 */
	async forwardToDiscord() {
		const discordChatManager = this.chatBridge.discord.get(this.type);

		if (!discordChatManager) return null;

		try {
			if (this.author) {
				const { player, member } = this;
				const discordMessage = await (this.discordMessage = discordChatManager.sendViaWebhook({
					content: this.prefixReplacedContent,
					username: member?.displayName
						?? player?.ign
						?? this.author.ign,
					avatarURL: member?.displayAvatarURL({ dynamic: true })
						?? await player?.imageURL
						?? await mojang.ign(this.author.ign).then(
							({ uuid }) => uuidToImgurBustURL(uuid),
							error => logger.error('[FORWARD TO DC]', error),
						)
						?? (member?.guild.me ?? this.client.user)?.displayAvatarURL({ dynamic: true }),
					allowedMentions: {
						parse: player?.hasDiscordPingPermission ? [ 'users' ] : [],
					},
				}));

				// inform user if user and role pings don't actually ping (can't use message.mentions to detect cause that is empty)
				if (/<@&\d{17,19}>/.test(discordMessage.content)) {
					this.author.send('you do not have permission to ping roles from in game chat');
					MessageUtil.react(discordMessage, NO_PING_EMOJI);
				} else if ((!player?.hasDiscordPingPermission && /<@!?\d{17,19}>/.test(discordMessage.content))) {
					this.author.send('you do not have permission to ping users from in game chat');
					MessageUtil.react(discordMessage, NO_PING_EMOJI);
				}

				return discordMessage;
			}

			return await (this.discordMessage = discordChatManager.sendViaBot({
				content: this.content,
				allowedMentions: { parse: [] },
			}));
		} catch (error) {
			return logger.error('[FORWARD TO DC]', error);
		}
	}

	/**
	 * confirms the action via a button collector
	 * @param questionOrOptions
	 */
	async awaitConfirmation(questionOrOptions: string | AwaitConfirmationOptions = {}) {
		const { question = 'confirm this action?', timeoutSeconds = 60, errorMessage = 'the command has been cancelled', ...options } = typeof questionOrOptions === 'string'
			? { question: questionOrOptions }
			: questionOrOptions;

		this.reply({
			content: question,
			...options,
		});

		const result = await this.chatBridge.minecraft.awaitMessages({
			filter: hypixelMessage => hypixelMessage.author?.ign === this.author!.ign,
			max: 1,
			time: timeoutSeconds * 1_000,
		});

		if (this.client.config.get('REPLY_CONFIRMATION').includes(result[0]?.content.toLowerCase())) return;

		throw errorMessage;
	}
}
