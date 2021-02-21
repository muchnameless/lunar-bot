'use strict';

const { Util } = require('discord.js');
const { nameToUnicode } = require('../../constants/emojiNameUnicodeConverter');
const HypixelMessageAuthor = require('./HypixelMessageAuthor');

/**
 * @typedef {object} TextComponent
 * @property {object} json
 * @property {string} text
 * @property {any[]} extra
 * @property {*} bold
 * @property {*} italic
 * @property {*} underlined
 * @property {*} strikethrough
 * @property {*} obfuscated
 * @property {string} color
 */

/**
 * @typedef {string} ChatPosition
 * * `chat`
 * * `system`
 * * `game_info`
 */

/**
 * @typedef {string} HypixelMessageType
 * * `guild`
 * * `party`
 * * `whisper`
 */


class HypixelMessage {
	/**
	 * @param {import('./ChatBridge')} chatBridge
	 * @param {TextComponent[]} jsonMessage
	 * @param {ChatPosition} position
	 */
	constructor(chatBridge, jsonMessage, position) {
		this.chatBridge = chatBridge;
		this.jsonMessage = jsonMessage;
		this.position = position;
		this.rawContent = jsonMessage.toString().trim();

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
			this.type = matched.groups.type?.toLowerCase() ?? (matched.groups.whisper ? 'whisper' : null);
			this.content = this.rawContent.slice(matched[0].length).replace(/ࠀ|⭍/g, '').trim();
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
	 * prettify message for discord, tries to replace :emoji: and others with the actually working discord render string
	 */
	get parsedContent() {
		return Util.escapeMarkdown(
			this.content
				.replace(/(?<!<|<a):(\S+):(?!\d+>)/g, (match, p1) => this.chatBridge.client.emojis.cache.find(e => e.name.toLowerCase() === p1.toLowerCase())?.toString() ?? nameToUnicode[match] ?? match) // emojis (custom and default)
				.replace(/(?<!<|<a):(\S+?):(?!\d+>)/g, (match, p1) => this.chatBridge.client.emojis.cache.find(e => e.name.toLowerCase() === p1.toLowerCase())?.toString() ?? nameToUnicode[match] ?? match) // emojis (custom and default)
				.replace(/#([a-z-]+)/gi, (match, p1) => this.chatBridge.client.channels.cache.find(ch => ch.name === p1.toLowerCase())?.toString() ?? match) // channels
				.replace(/(?<!<)@([!&])?(\S+)(?!\d+>)/g, (match, p1, p2) => {
					switch (p1) {
						case '!': // members/users
							return this.chatBridge.client.lgGuild?.members.cache.find(m => m.displayName.toLowerCase() === p2.toLowerCase())?.toString() // members
								?? this.chatBridge.client.users.cache.find(u => u.username.toLowerCase() === p2.toLowerCase())?.toString() // users
								?? match;

						case '&': // roles
							return this.chatBridge.client.lgGuild?.roles.cache.find(r => r.name.toLowerCase() === p2.toLowerCase())?.toString() // roles
								?? match;

						default: { // players, members/users, roles
							const player = this.chatBridge.client.players.cache.find(p => p.ign.toLowerCase() === p2.toLowerCase());

							if (player?.inDiscord) return `<@${player.discordID}>`;

							return this.chatBridge.client.lgGuild?.members.cache.find(m => m.displayName.toLowerCase() === p2.toLowerCase())?.toString() // members
								?? this.chatBridge.client.users.cache.find(u => u.username.toLowerCase() === p2.toLowerCase())?.toString() // users
								?? this.chatBridge.client.lgGuild?.roles.cache.find(r => r.name.toLowerCase() === p2.toLowerCase())?.toString() // roles
								?? match;
						}
					}
				}),
		);
	}

	/**
	 * replies ingame to the message
	 * @param {string} message
	 */
	async reply(message) {
		switch (this.type) {
			case 'guild':
				return this.chatBridge.gchat(message);

			case 'party':
				return this.chatBridge.pchat(message);

			case 'whisper':
				return this.author.send(message);

			default:
				throw new Error('unknown type to reply to');
		}
	}

	/**
	 * forwards the message to discord via the chatBridge's webhook
	 */
	async forwardToDiscord() {
		if (this.author) {
			const player = this.player;
			const member = await player?.discordMember;

			return this.chatBridge.sendViaWebhook({
				username: member?.displayName ?? player?.ign ?? this.author.ign,
				avatarURL: member?.user.displayAvatarURL({ dynamic: true }) ?? player?.image ?? this.chatBridge.client.user.displayAvatarURL({ dynamic: true }),
				content: this.parsedContent,
				allowedMentions: { parse: player?.hasDiscordPingPermission ? [ 'users' ] : [] },
			});
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
