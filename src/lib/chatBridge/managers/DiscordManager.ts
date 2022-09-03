import {
	ApplicationCommandOptionType,
	chatInputApplicationCommandMention,
	Collection,
	escapeMarkdown as djsEscapeMarkdown,
	time,
	TimestampStyles,
	userMention,
	type GuildEmoji,
	type Snowflake,
} from 'discord.js';
import ms, { type StringValue } from 'ms';
import { Op } from 'sequelize';
import { type ChatBridge } from '../ChatBridge.js';
import { EMOJI_NAME_TO_UNICODE, INVISIBLE_CHARACTER_REGEXP, type HypixelMessageType } from '../constants/index.js';
import { DiscordChatManager, type ReadyDiscordChatManager } from './DiscordChatManager.js';
import { asyncReplace, autocorrect, escapeMarkdown, replaceSmallLatinCapitalLetters } from '#functions';
import { logger } from '#logger';

export type DiscordChatManagerResolvable = DiscordChatManager | HypixelMessageType | Snowflake;

export interface ReadyDiscordManager extends DiscordManager {
	get channels(): Collection<Snowflake, ReadyDiscordChatManager>;
	readonly channelsByIds: Collection<string, ReadyDiscordChatManager>;
	readonly channelsByType: Collection<string, ReadyDiscordChatManager>;
}

export class DiscordManager {
	public readonly chatBridge: ChatBridge;

	public readonly channelsByIds = new Collection<string, DiscordChatManager>();

	public readonly channelsByType = new Collection<string, DiscordChatManager>();

	public constructor(chatBridge: ChatBridge) {
		this.chatBridge = chatBridge;
	}

	public get client() {
		return this.chatBridge.client;
	}

	public get channels() {
		return this.channelsByType;
	}

	public get ready() {
		return this.channels.size ? this.channels.every((channel) => channel.ready) : false;
	}

	public set ready(value) {
		for (const channel of this.channels.values()) {
			channel.ready = value;
		}
	}

	/**
	 * whether all channels are ready
	 */
	public isReady(): this is ReadyDiscordManager {
		return this.ready;
	}

	/**
	 * resolves the input to a DiscordChatManager instance
	 *
	 * @param input
	 */
	public resolve(input?: DiscordChatManagerResolvable) {
		if (input instanceof DiscordChatManager) return input;
		return this.channelsByType.get(input!) ?? this.channelsByIds.get(input!) ?? null;
	}

	/**
	 * instantiates the DiscordChatManagers
	 */
	public async init() {
		const promises: Promise<DiscordChatManager>[] = [];

		for (const chatBridgeChannel of this.chatBridge.hypixelGuild!.chatBridgeChannels) {
			if (this.channelsByType.has(chatBridgeChannel.type)) continue; // prevents multiple instantiations of the same manager

			const channelManager = new DiscordChatManager(this.chatBridge, chatBridgeChannel);

			this.channelsByType.set(chatBridgeChannel.type, channelManager);
			this.channelsByIds.set(chatBridgeChannel.channelId, channelManager);

			promises.push(channelManager.init());
		}

		return Promise.all(promises);
	}

	/**
	 * custom or basic emoji search by name
	 *
	 * @param fullMatch
	 * @param inColon
	 */
	private _findEmojiByName(fullMatch: string, inColon: string) {
		const emoji =
			EMOJI_NAME_TO_UNICODE[fullMatch.replaceAll('_', '').toLowerCase() as keyof typeof EMOJI_NAME_TO_UNICODE];

		if (emoji) return emoji;

		const { value, similarity } = autocorrect(
			inColon,
			// https://discord.com/developers/docs/resources/emoji#emoji-object name - ?string (can be null only in reaction emoji objects)
			this.client.emojis.cache as Collection<string, GuildEmoji & { name: string }>,
			'name',
		);

		if (similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')) return `${value}`;
		return null;
	}

	/**
	 * readable string -> discord markdown
	 * async to allow database queries for @uncached_player_ign
	 *
	 * @param string
	 * @param fromMinecraft whether the message was sent in mc chat
	 */
	public async parseContent(string: string, fromMinecraft = false) {
		return escapeMarkdown(
			djsEscapeMarkdown(
				// @mentions
				(
					await asyncReplace(string, /(?<!<)@(?<type>!|&)?(?<name>\w+)(?!\d{17,20}>)/g, async (match) => {
						switch (match.groups!.type) {
							// members/users
							case '!': {
								const TO_SEARCH = match.groups!.name!.toLowerCase();
								const memberOrUser =
									this.chatBridge.hypixelGuild?.discordGuild?.members.cache.find(
										({ displayName }) => displayName.toLowerCase() === TO_SEARCH,
									) ?? // members
									this.client.users.cache.find(({ username }) => username.toLowerCase() === TO_SEARCH); // users

								return memberOrUser?.toString() ?? match[0]!;
							}

							// roles
							case '&': {
								const TO_SEARCH = match.groups!.name!.toLowerCase();
								const role = this.chatBridge.hypixelGuild?.discordGuild?.roles.cache.find(
									({ name }) => name.toLowerCase() === TO_SEARCH,
								);

								return role?.toString() ?? match[0]!;
							}

							// players, members/users, roles
							default: {
								const TO_SEARCH = match.groups!.name!.toLowerCase();
								if (!TO_SEARCH) return match[0]!;

								const player =
									this.client.players.cache.find(({ ign }) => ign.toLowerCase() === TO_SEARCH) ??
									(await this.client.players.fetch({ ign: { [Op.iLike]: TO_SEARCH } }));

								// player can be pinged
								if (player?.inDiscord || (player?.discordId && !player.discordId.includes('#'))) {
									return userMention(player.discordId!);
								}

								return match[0]!;
							}
						}
					})
				)
					.replace(INVISIBLE_CHARACTER_REGEXP, '') // remove invisible mc characters
					.replace(/(?<=^\s*)(?=>)/, '\\') // escape '>' at the beginning
					.replace(
						// emojis (custom and default)
						/(?<!<[at]?):(\S+):(?!\d{17,20}>)/g,
						(match, p1: string) =>
							this._findEmojiByName(match, p1) ??
							match.replace(/:(\S+?):/g, (_match, _p1: string) =>
								p1.length === _p1.length ? _match : this._findEmojiByName(_match, _p1) ?? _match,
							),
					)
					.replace(
						// channels
						/#(\S+)/g,
						(match, p1: string) => {
							const TO_SEARCH = p1.toLowerCase().replace(/[^a-z]/gi, '');
							if (!TO_SEARCH) return match;

							return (
								this.chatBridge.hypixelGuild?.discordGuild?.channels.cache
									.find(({ name }) => replaceSmallLatinCapitalLetters(name).replace(/[^a-z]/gi, '') === TO_SEARCH)
									?.toString() ?? match
							);
						},
					)
					// timestamps
					.replace(
						/(\bin )?(\ban?|\d+) ([a-z]+)( ago\b)?/gi,
						(match, future: string, quantifier: string, timestring: string, past: string) => {
							if (!future && !past) return match;

							try {
								const date = new Date(
									Date.now() + ms(`${Number(quantifier) || 1} ${timestring}` as StringValue) * (future ? 1 : -1),
								);
								if (Number.isNaN(date.getTime())) return match;

								return time(date, TimestampStyles.RelativeTime);
							} catch (error) {
								logger.error({ err: error, match, future, quantifier, timestring, past }, 'parseContent');
								return match;
							}
						},
					)
					// /commands
					.replace(
						/\/([\w-]{1,32})(?: ([\w-]{1,32}))?(?: ([\w-]{1,32}))?/g,
						(
							match,
							_commandName: string,
							_groupOrSubcommandName: string | undefined,
							_subcommandName: string | undefined,
						) => {
							const commandName = _commandName.toLowerCase();
							const groupOrSubcommandName = _groupOrSubcommandName?.toLowerCase();
							const subcommandName = _subcommandName?.toLowerCase();

							const command = this.client.application!.commands.cache.find(({ name }) => name === commandName);
							if (!command) return match;

							const replaced: (string | undefined)[] = [];
							const firstOption = command.options.find(({ name }) => name === groupOrSubcommandName);

							switch (firstOption?.type) {
								// command
								case undefined:
									replaced.push(
										chatInputApplicationCommandMention(commandName, command.id),
										groupOrSubcommandName,
										subcommandName,
									);
									break;

								// command + subcommand
								case ApplicationCommandOptionType.Subcommand:
									replaced.push(
										chatInputApplicationCommandMention(commandName, groupOrSubcommandName!, command.id),
										subcommandName,
									);
									break;

								// command + subcommand group + ???
								case ApplicationCommandOptionType.SubcommandGroup: {
									const secondOption = firstOption.options!.find(({ name }) => name === subcommandName);

									switch (secondOption?.type) {
										// command + subcommand group + subcommand
										case ApplicationCommandOptionType.Subcommand:
											replaced.push(
												chatInputApplicationCommandMention(
													commandName,
													groupOrSubcommandName!,
													subcommandName!,
													command.id,
												),
											);
											break;

										// command + subcommand group
										default:
											replaced.push(
												chatInputApplicationCommandMention(commandName, groupOrSubcommandName!, command.id),
												subcommandName,
											);
											break;
									}

									break;
								}
							}

							return replaced.filter(Boolean).join(' ');
						},
					),
				{
					codeBlock: false,
					inlineCode: false,
					codeBlockContent: false,
					inlineCodeContent: false,
					// escapeNonURL already escapes '*' and '_'
					italic: false,
					bold: false,
					underline: false,
				},
			),
			fromMinecraft,
		);
	}
}
