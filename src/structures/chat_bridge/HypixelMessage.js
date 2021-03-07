'use strict';

const ChatMessage = require('prismarine-chat')(require('../../constants/chatBridge').VERSION);
const { messageTypes: { WHISPER, GUILD, PARTY } } = require('../../constants/chatBridge');
const { NO_BELL } = require('../../constants/emojiCharacters');
const HypixelMessageAuthor = require('./HypixelMessageAuthor');

/**
 * @typedef {string} HypixelMessageType
 * * `guild`
 * * `party`
 * * `whisper`
 */


class HypixelMessage extends ChatMessage {
	/**
	 * @param {import('./ChatBridge')} chatBridge
	 * @param {number} position
	 * @param {} message
	 * @param {?boolean} displayWarning
	 */
	constructor(chatBridge, position, message, displayWarning) {
		super(message, displayWarning);

		this.chatBridge = chatBridge;
		this.position = { 0: 'chat', 1: 'system', 2: 'gameInfo' }[position];
		this.rawContent = this.toString().trim();

		/**
		 * Guild > [HypixelRank] ign [GuildRank]
		 * From [HypixelRank] ign
		 */
		const matched = this.rawContent.match(/^(?:(?<type>Guild|Party) > |(?<whisper>From) )(?:\[(?<hypixelRank>.+?)\] )?(?<ign>\w+)(?: \[(?<guildRank>\w+)\])?: /);

		if (matched) {
			this.author = new HypixelMessageAuthor(this.chatBridge, {
				hypixelRank: matched.groups.hypixelRank,
				ign: matched.groups.ign,
				guildRank: matched.groups.guildRank,
			});
			this.type = matched.groups.type?.toLowerCase() ?? (matched.groups.whisper ? WHISPER : null);
			this.content = this.rawContent
				.slice(matched[0].length)
				.replace(/ࠀ|⭍/g, '')
				.trim();
		} else {
			this.author = null;
			this.type = null;
			this.content = this.rawContent.replace(/ࠀ|⭍/g, '').trim();
		}
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
	get guild() {
		return this.type === GUILD ? this.player?.guild : null;
	}

	/**
	 * prettify message for discord, tries to replace :emoji: and others with the actually working discord render string
	 */
	get parsedContent() {
		return this.chatBridge._parseMinecraftMessageToDiscord(this.content);
	}

	/**
	 * content with minecraft formatting codes
	 */
	get formattedContent() {
		return this.toMotd().trim();
	}

	/**
	 * replies ingame (and on discord if guild chat) to the message
	 * @param {string} message
	 */
	async reply(message) {
		switch (this.type) {
			case GUILD:
				return this.chatBridge.broadcast(message);

			case PARTY:
				return this.chatBridge.pchat(message, { maxParts: Infinity });

			case WHISPER:
				return this.author.send(message, { maxParts: Infinity });

			default:
				throw new Error(`unknown type to reply to: ${this.type}: ${this.rawContent}`);
		}
	}

	/**
	 * forwards the message to discord via the chatBridge's webhook, if the guild has the chatBridge enabled
	 */
	async forwardToDiscord() {
		if (this.author) {
			const { player } = this;
			const member = await player?.discordMember;
			const message = await this.chatBridge.sendViaWebhook({
				username: member?.displayName ?? player?.ign ?? this.author.ign,
				avatarURL: member?.user.displayAvatarURL({ dynamic: true }) ?? player?.image ?? this.chatBridge.client.user.displayAvatarURL({ dynamic: true }),
				content: this.parsedContent,
				allowedMentions: { parse: player?.hasDiscordPingPermission ? [ 'users' ] : [] },
			});

			// inform user if user and role pings don't actually ping (can't use message.mentions cause that is empty)
			if ((!player?.hasDiscordPingPermission && /<@!?\d+>/.test(message.content)) || /<@&\d+>/.test(message.content)) message.reactSafely(NO_BELL);

			return message;
		}

		return this.chatBridge.sendViaWebhook({
			username: this.chatBridge.guild.name,
			avatarURL: this.chatBridge.client.user.displayAvatarURL({ dynamic: true }),
			content: this.content,
			allowedMentions: { parse: [] },
		});
	}
}

module.exports = HypixelMessage;
