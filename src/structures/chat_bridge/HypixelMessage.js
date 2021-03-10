'use strict';

const ChatMessage = require('prismarine-chat')(require('../../constants/chatBridge').VERSION);
const { messageTypes: { WHISPER, GUILD, PARTY } } = require('../../constants/chatBridge');
const { NO_BELL } = require('../../constants/emojiCharacters');
const mojang = require('../../api/mojang');
const HypixelMessageAuthor = require('./HypixelMessageAuthor');
const logger = require('../../functions/logger');

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
		/**
		 * @type {?HypixelMessageType}
		 */
		this.position = { 0: 'chat', 1: 'system', 2: 'gameInfo' }[position] ?? null;
		/**
		 * raw content string
		 */
		this.rawContent = this.toString();
		/**
		 * content with invis chars removed
		 */
		this.cleanedContent = this.rawContent.replace(/ࠀ|⭍/g, '').trim();

		/**
		 * Guild > [HypixelRank] ign [GuildRank]
		 * From [HypixelRank] ign
		 */
		const matched = this.cleanedContent.match(/^(?:(?<type>Guild|Party) > |(?<whisper>From) )(?:\[(?<hypixelRank>.+?)\] )?(?<ign>\w+)(?: \[(?<guildRank>\w+)\])?: /);

		if (matched) {
			this.author = new HypixelMessageAuthor(this.chatBridge, {
				hypixelRank: matched.groups.hypixelRank,
				ign: matched.groups.ign,
				guildRank: matched.groups.guildRank,
			});
			this.type = matched.groups.type?.toLowerCase() ?? (matched.groups.whisper ? WHISPER : null);
			this.content = this.cleanedContent.slice(matched[0].length).trimLeft();
		} else {
			this.author = null;
			this.type = null;
			this.content = this.cleanedContent;
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
		await this.chatBridge.discordQueue.wait();

		try {
			if (this.author) {
				const { player } = this;
				const member = await player?.discordMember;
				const message = await this.chatBridge.sendViaWebhook({
					username: member?.displayName
						?? player?.ign
						?? this.author.ign,
					avatarURL: member?.user.displayAvatarURL({ dynamic: true })
						?? player?.image
						?? await mojang.getUUID(this.author.ign).then(uuid => `https://visage.surgeplay.com/bust/${uuid}`, error => logger.error(`[HYPIXEL MESSAGE]: ${error.name} ${error.code}: ${error.message}`))
						?? this.chatBridge.client.user.displayAvatarURL({ dynamic: true }),
					content: this.parsedContent,
					allowedMentions: {
						parse: player?.hasDiscordPingPermission ? [ 'users' ] : [],
					},
				});

				// inform user if user and role pings don't actually ping (can't use message.mentions cause that is empty)
				if ((!player?.hasDiscordPingPermission && /<@!?\d+>/.test(message.content)) || /<@&\d+>/.test(message.content)) message.reactSafely(NO_BELL);

				return message;
			}

			return await this.chatBridge.sendViaWebhook({
				username: this.chatBridge.guild.name,
				avatarURL: this.chatBridge.client.user.displayAvatarURL({ dynamic: true }),
				content: this.content,
				allowedMentions: { parse: [] },
			});
		} finally {
			this.chatBridge.discordQueue.shift();
		}
	}
}

module.exports = HypixelMessage;
