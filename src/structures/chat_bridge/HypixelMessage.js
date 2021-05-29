'use strict';

const ChatMessage = require('prismarine-chat')(require('./constants/settings').MC_CLIENT_VERSION);
const { messageTypes: { WHISPER, GUILD, OFFICER, PARTY }, invisibleCharacterRegExp } = require('./constants/chatBridge');
const { spamMessages } = require('./constants/commandResponses');
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


module.exports = class HypixelMessage extends ChatMessage {
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
		 * forwarded message
		 * @type {Promise<?import('../extensions/Message')>}
		 */
		this.discordMessage = Promise.resolve(null);
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
		this.cleanedContent = this.rawContent.replace(invisibleCharacterRegExp, '').trim();

		/**
		 * Guild > [HypixelRank] ign [GuildRank]: message
		 * Party > [HypixelRank] ign [GuildRank]: message
		 * Officer > [HypixelRank] ign [GuildRank]: message
		 * From [HypixelRank] ign: message
		 */
		const matched = this.cleanedContent.match(/^(?:(?<type>Guild|Officer|Party) > |(?<whisper>From|To) )(?:\[.+?\] )?(?<ign>\w+)(?: \[(?<guildRank>\w+)\])?: /);

		if (matched) {
			this.type = matched.groups.type?.toLowerCase() ?? (matched.groups.whisper ? WHISPER : null);

			/** @type {string|undefined} */
			const authorInfo = this.extra?.[0].clickEvent?.value;

			this.author = new HypixelMessageAuthor(
				this.chatBridge,
				matched.groups.whisper !== 'To'
					? {
						ign: matched.groups.ign,
						guildRank: matched.groups.guildRank,
						uuid: authorInfo?.slice(authorInfo.indexOf(' ') + 1).replace(/-/g, ''),
					}
					: {
						ign: this.chatBridge.bot.ign,
						guildRank: null,
						uuid: this.chatBridge.bot.uuid,
					},
			);

			this.content = this.cleanedContent.slice(matched[0].length).trimLeft();
			this.spam = false;
		} else {
			this.type = null;
			this.author = null;
			this.content = this.cleanedContent;
			this.spam = spamMessages.test(this.content);
		}
	}

	get logInfo() {
		return this.author.ign ?? 'unknown author';
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
		return this.author?.ign === this.chatBridge.bot.ign;
	}

	/**
	 * wether the message was sent by a non-bot user
	 */
	get isUserMessage() {
		return this.type && !this.me;
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
	 * content with minecraft formatting codes
	 */
	get formattedContent() {
		return this.toMotd().trim();
	}

	/**
	 * to make methods for dc messages compatible with mc messages
	 */
	get member() {
		return this.author?.member;
	}

	/**
	 * fetch all missing data
	 */
	async init() {
		await this.author?.init();
		return this;
	}

	/**
	 * alias for reply, to make methods for dc messages compatible with mc messages
	 * @param {string} emoji
	 * @returns {Promise<[boolean, ?import('discord.js').MessageReaction|import('../extensions/Message')]>}
	 */
	async react(emoji) {
		switch (this.type) {
			case GUILD:
			case OFFICER: {
				return Promise.all([
					this.author.send(emoji),
					(await this.discordMessage.catch(() => null))?.react(emoji)
							?? this.chatBridge.discord.get(this.type)?.sendViaBot(`${this.member ?? `@${this.author.ign}`} ${emoji}`),
				]);
			}

			default:
				return this.author?.send(emoji) ?? this.reply(emoji);
		}
	}

	/**
	 * replies ingame (and on discord if guild chat) to the message
	 * @param {string} message
	 */
	async reply(message) {
		switch (this.type) {
			case GUILD:
			case OFFICER: {
				const result = await this.chatBridge.broadcast(
					message,
					{
						hypixelMessage: this,
						discord: {
							allowedMentions: { parse: [] },
						},
					},
				);

				// DM author the message if sending to gchat failed
				if (!result[0]) this.author.send(`an error occurred while replying in ${this.type} chat\n${message}`);

				return result;
			}

			case PARTY:
				return this.chatBridge.minecraft.pchat(message, { maxParts: Infinity });

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
		const discordChatManager = this.chatBridge.discord.get(this.type);

		if (!discordChatManager) return null;

		try {
			if (this.author) {
				const { player, member } = this;
				const discordMessage = await (this.discordMessage = discordChatManager.sendViaWebhook(
					this.content,
					{
						username: member?.displayName
							?? player?.ign
							?? this.author.ign,
						avatarURL: member?.user.displayAvatarURL({ dynamic: true })
							?? player?.image
							?? await mojang.ign(this.author.ign).then(
								({ uuid }) => `https://visage.surgeplay.com/bust/${uuid}`,
								error => logger.error('[FORWARD TO DC]', error),
							)
							?? this.client.user.displayAvatarURL({ dynamic: true }),
						allowedMentions: {
							parse: player?.hasDiscordPingPermission ? [ 'users' ] : [],
						},
					},
				));

				// inform user if user and role pings don't actually ping (can't use message.mentions to detect cause that is empty)
				if (/<@&\d{17,19}>/.test(discordMessage.content)) {
					this.author.send('you do not have permission to @ roles from in game chat');
					discordMessage.react(NO_BELL);
				} else if ((!player?.hasDiscordPingPermission && /<@!?\d{17,19}>/.test(discordMessage.content))) {
					this.author.send('you do not have permission to @ users from in game chat');
					discordMessage.react(NO_BELL);
				}

				return discordMessage;
			}

			return await (this.discordMessage = discordChatManager.sendViaBot(
				this.content,
				{ allowedMentions: { parse: [] } },
			));
		} catch (error) {
			logger.error('[FORWARD TO DC]', error);
		}
	}
};
