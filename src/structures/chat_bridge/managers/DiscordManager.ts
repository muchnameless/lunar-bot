import { Collection, Util, Formatters } from 'discord.js';
import pkg from 'sequelize';
const { Op } = pkg;
import { EMOJI_NAME_TO_UNICODE, INVISIBLE_CHARACTER_REGEXP } from '../constants';
import { autocorrect, replaceSmallLatinCapitalLetters } from '../../../functions';
import { DiscordChatManager } from './DiscordChatManager';
import type { Snowflake } from 'discord.js';
import type { MESSAGE_TYPES } from '../constants';
import type { ChatBridge } from '../ChatBridge';

export type DiscordChatManagerResolvable = keyof typeof MESSAGE_TYPES | Snowflake | DiscordChatManager;

export class DiscordManager {
	chatBridge: ChatBridge;
	channelsByIds = new Collection<string, DiscordChatManager>();
	channelsByType = new Collection<string, DiscordChatManager>();

	constructor(chatBridge: ChatBridge) {
		this.chatBridge = chatBridge;
	}

	/**
	 * escapes '*' and '_' if those are neither within an URL nor a code block or inline code
	 * @param string
	 * @param block
	 */
	static #escapeNonURL(string: string, block = 0): string {
		switch (block) {
			case 0:
				return string
					.split('```')
					.map((subString, index, array) => {
						if (index % 2 && index !== array.length - 1) return subString;
						return this.#escapeNonURL(subString, 1);
					})
					.join('```');

			case 1:
				return string
					.split(/(?<=^|[^`])`(?=[^`]|$)/)
					.map((subString, index, array) => {
						if (index % 2 && index !== array.length - 1) return subString;
						return this.#escapeNonURL(subString, 2);
					})
					.join('`');

			case 2:
				return string
					.replace(/(?<!\\)(?=\*)/g, '\\') // escape italic 1/2
					.replace(/(\S*)_([^\s_]*)/g, (match, p1: string, p2: string) => {
						// escape italic 2/2 & underline
						if (/^https?:\/\/|^www\./i.test(match)) return match; // don't escape URLs
						if (p1.includes('<') || p2.includes('>')) return match; // don't escape emojis
						return `${p1.replace(/(?<!\\)(?=_)/g, '\\')}${p1.endsWith('\\') ? '' : '\\'}_${p2}`; // escape not already escaped '_'
					});

			default:
				return string;
		}
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
	#findEmojiByName(fullMatch: string, inColon: string) {
		const emoji =
			EMOJI_NAME_TO_UNICODE[fullMatch.replaceAll('_', '').toLowerCase() as keyof typeof EMOJI_NAME_TO_UNICODE];

		if (emoji) return emoji;

		const { value, similarity } = autocorrect(inColon, this.client.emojis.cache, 'name');

		if (similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')) return `${value}`;

		return fullMatch;
	}

	/**
	 * readable string -> discord markdown
	 * async to allow database queries for @uncached_player_ign
	 * @param string
	 */
	async parseContent(string: string) {
		let _string = string;

		// @mentions
		for (const match of string.matchAll(/(?<!<)@(?<type>!|&)?(?<name>\S+)(?!\d{17,19}>)/g)) {
			const [FULL_MATCH] = match;

			switch (match.groups!.type) {
				// members/users
				case '!': {
					const TO_SEARCH = match.groups!.name.toLowerCase();
					const MENTION =
						this.chatBridge.hypixelGuild?.discordGuild?.members.cache
							.find(({ displayName }) => displayName.toLowerCase() === TO_SEARCH)
							?.toString() ?? // members
						this.client.users.cache.find(({ username }) => username.toLowerCase() === TO_SEARCH)?.toString(); // users

					if (MENTION) _string = _string.replaceAll(FULL_MATCH, MENTION);
					continue;
				}

				// roles
				case '&': {
					const TO_SEARCH = match.groups!.name.toLowerCase();
					const MENTION = this.chatBridge.hypixelGuild?.discordGuild?.roles.cache
						.find(({ name }) => name.toLowerCase() === TO_SEARCH)
						?.toString(); // roles

					if (MENTION) _string = _string.replaceAll(FULL_MATCH, MENTION);
					continue;
				}

				// players, members/users, roles
				default: {
					const TO_SEARCH = match.groups!.name.replace(/\W/g, '').toLowerCase();
					if (!TO_SEARCH) continue;

					const player =
						this.client.players.cache.find(({ ign }) => ign.toLowerCase() === TO_SEARCH) ??
						(await this.client.players.fetch({ ign: { [Op.iLike]: TO_SEARCH } }));

					// player can be pinged
					if (player?.inDiscord || (player?.discordId && !player.discordId.includes('#'))) {
						_string = _string.replaceAll(FULL_MATCH, Formatters.userMention(player.discordId!));
					}
				}
			}
		}

		return DiscordManager.#escapeNonURL(
			Util.escapeMarkdown(
				_string
					.replace(INVISIBLE_CHARACTER_REGEXP, '') // remove invisible mc characters
					.replace(/(?<=^\s*)(?=>)/, '\\') // escape '>' at the beginning
					.replace(
						// emojis (custom and default)
						/(?<!<a?):(\S+):(?!\d{17,19}>)/g,
						(match, p1: string) => this.#findEmojiByName(match, p1),
					)
					.replace(
						// emojis (custom and default)
						/(?<!<a?):(\S+?):(?!\d{17,19}>)/g,
						(match, p1: string) => this.#findEmojiByName(match, p1),
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
		);
	}
}
