import {
	ApplicationCommandOptionType,
	Collection,
	escapeMarkdown as djsEscapeMarkdown,
	time,
	TimestampStyles,
	userMention,
} from 'discord.js';
import { Op } from 'sequelize';
import ms from 'ms';
import { asyncReplace, autocorrect, escapeMarkdown, replaceSmallLatinCapitalLetters } from '#functions';
import { EMOJI_NAME_TO_UNICODE, INVISIBLE_CHARACTER_REGEXP } from '../constants';
import { DiscordChatManager } from './DiscordChatManager';
import type { GuildEmoji, Snowflake } from 'discord.js';
import type { HypixelMessageType } from '../constants';
import type { ChatBridge } from '../ChatBridge';

export type DiscordChatManagerResolvable = HypixelMessageType | Snowflake | DiscordChatManager;

export class DiscordManager {
	chatBridge: ChatBridge;
	channelsByIds = new Collection<string, DiscordChatManager>();
	channelsByType = new Collection<string, DiscordChatManager>();

	constructor(chatBridge: ChatBridge) {
		this.chatBridge = chatBridge;
	}

	get client() {
		return this.chatBridge.client;
	}

	get channels() {
		return this.channelsByType;
	}

	get ready() {
		return this.channels.size ? this.channels.every((channel) => channel.ready) : false;
	}

	set ready(value) {
		for (const channel of this.channels.values()) {
			channel.ready = value;
		}
	}

	/**
	 * resolves the input to a DiscordChatManager instance
	 * @param input
	 */
	resolve(input?: DiscordChatManagerResolvable) {
		if (input instanceof DiscordChatManager) return input;
		return this.channelsByType.get(input!) ?? this.channelsByIds.get(input!) ?? null;
	}

	/**
	 * instantiates the DiscordChatManagers
	 */
	init() {
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
	}

	/**
	 * readable string -> discord markdown
	 * async to allow database queries for @uncached_player_ign
	 * @param string
	 * @param fromMinecraft whether the message was sent in mc chat
	 */
	async parseContent(string: string, fromMinecraft = false) {
		return escapeMarkdown(
			djsEscapeMarkdown(
				// @mentions
				(
					await asyncReplace(string, /(?<!<)@(?<type>!|&)?(?<name>\w+)(?!\d{17,20}>)/g, async (match) => {
						switch (match.groups!.type) {
							// members/users
							case '!': {
								const TO_SEARCH = match.groups!.name!.toLowerCase();
								const MENTION =
									this.chatBridge.hypixelGuild?.discordGuild?.members.cache
										.find(({ displayName }) => displayName.toLowerCase() === TO_SEARCH)
										?.toString() ?? // members
									this.client.users.cache.find(({ username }) => username.toLowerCase() === TO_SEARCH)?.toString(); // users

								if (MENTION) return MENTION;
								break;
							}

							// roles
							case '&': {
								const TO_SEARCH = match.groups!.name!.toLowerCase();
								const MENTION = this.chatBridge.hypixelGuild?.discordGuild?.roles.cache
									.find(({ name }) => name.toLowerCase() === TO_SEARCH)
									?.toString(); // roles

								if (MENTION) return MENTION;
								break;
							}

							// players, members/users, roles
							default: {
								const TO_SEARCH = match.groups!.name!.toLowerCase();
								if (!TO_SEARCH) break;

								const player =
									this.client.players.cache.find(({ ign }) => ign.toLowerCase() === TO_SEARCH) ??
									(await this.client.players.fetch({ ign: { [Op.iLike]: TO_SEARCH } }));

								// player can be pinged
								if (player?.inDiscord || (player?.discordId && !player.discordId.includes('#'))) {
									return userMention(player.discordId!);
								}
							}
						}

						return match[0]!;
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
								p1.length !== _p1.length ? this._findEmojiByName(_match, _p1) ?? _match : _match,
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

							const date = new Date(Date.now() + ms(`${Number(quantifier) || 1} ${timestring}`) * (future ? 1 : -1));
							if (Number.isNaN(date.getTime())) return match;

							return time(date, TimestampStyles.RelativeTime);
						},
					)
					// /commands
					.replace(
						/\/([-\w]{1,32})(?: ([-\w]{1,32}))?(?: ([-\w]{1,32}))?/g,
						(match, _commandName: string, _groupOrSubcommand: string | undefined, _subcommand: string | undefined) => {
							const commandName = _commandName.toLowerCase();
							const groupOrSubcommand = _groupOrSubcommand?.toLowerCase();
							const subcommand = _subcommand?.toLowerCase();

							const command = this.client.application!.commands.cache.find(({ name }) => name === commandName);
							if (!command) return match;

							switch (command.options[0]?.type) {
								case ApplicationCommandOptionType.SubcommandGroup: {
									const group = command.options.find(({ name }) => name === groupOrSubcommand);

									switch (group?.type) {
										case undefined:
											return `</${commandName}:${command.id}> ${groupOrSubcommand} ${subcommand}`;

										case ApplicationCommandOptionType.Subcommand:
											if (group.options?.some(({ name }) => name === subcommand)) {
												return `</${commandName} ${groupOrSubcommand} ${subcommand}:${command.id}>`;
											}
										// fallthrough

										default:
											return `</${commandName} ${groupOrSubcommand}:${command.id}> ${subcommand}`;
									}
								}

								case ApplicationCommandOptionType.Subcommand:
									if (command.options.some(({ name }) => name === groupOrSubcommand)) {
										return `</${commandName} ${groupOrSubcommand}:${command.id}> ${subcommand}`;
									}
								// fallthrough

								default:
									return `</${commandName}:${command.id}> ${groupOrSubcommand} ${subcommand}`;
							}
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
