import { Collection, Util, Formatters } from 'discord.js';
import { EMOJI_NAME_TO_UNICODE, INVISIBLE_CHARACTER_REGEXP } from '../constants';
import { autocorrect } from '../../../functions';
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
					.replaceAll('*', '\\*') // escape italic 1/2
					.replace(/(\S*)_([^\s_]*)/g, (match, p1: string, p2: string) => {
						// escape italic 2/2 & underline
						if (/^https?:\/\/|^www\./i.test(match)) return match; // don't escape URLs
						if (p1.includes('<') || p2.includes('>')) return match; // don't escape emojis
						return `${p1.replaceAll('_', '\\_')}\\_${p2}`;
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
	 * @param string
	 */
	parseContent(string: string) {
		return DiscordManager.#escapeNonURL(
			Util.escapeMarkdown(
				string
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
						/#([a-z-]+)/gi,
						(match, p1: string) =>
							this.chatBridge.hypixelGuild?.discordGuild?.channels.cache
								.find(({ name }) => name === p1.toLowerCase())
								?.toString() ?? match,
					)
					.replace(
						// @mentions
						/(?<!<)@(!|&)?(\S+)(?!\d{17,19}>)/g,
						(match, p1: string, p2: string) => {
							switch (p1) {
								case '!': // members/users
									return (
										this.chatBridge.hypixelGuild?.discordGuild?.members.cache
											.find(({ displayName }) => displayName.toLowerCase() === p2.toLowerCase())
											?.toString() ?? // members
										this.client.users.cache
											.find(({ username }) => username.toLowerCase() === p2.toLowerCase())
											?.toString() ?? // users
										match
									);

								case '&': // roles
									return (
										this.chatBridge.hypixelGuild?.discordGuild?.roles.cache
											.find(({ name }) => name.toLowerCase() === p2.toLowerCase())
											?.toString() ?? // roles
										match
									);

								default: {
									// players, members/users, roles
									const IGN = p2.replace(/\W/g, '').toLowerCase();

									if (!IGN.length) return match;

									const player = this.client.players.cache.find(({ ign }) => ign.toLowerCase() === IGN);

									if (player?.inDiscord) return Formatters.userMention(player.discordId!); // player can be pinged

									return match;
								}
							}
						},
					),
				{
					codeBlock: false,
					inlineCode: false,
					codeBlockContent: false,
					inlineCodeContent: false,
					italic: false,
					underline: false,
				},
			),
		);
	}
}
