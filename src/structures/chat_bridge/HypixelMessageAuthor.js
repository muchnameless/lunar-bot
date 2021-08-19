import { mojang } from '../../api/mojang.js';
import { logger } from '../../functions/index.js';


export class HypixelMessageAuthor {
	/**
	 * @param {import('./ChatBridge').ChatBridge} chatBridge
	 * @param {object} param1
	 * @param {string} [param1.ign]
	 * @param {string} [param1.guildRank]
	 * @param {string} [param1.uuid]
	 */
	constructor(chatBridge, { ign, guildRank, uuid }) {
		this.chatBridge = chatBridge;
		this.ign = ign ?? null;
		this.guildRank = guildRank ?? null;

		/**
		 * player object of the message author
		 * @type {?import('../database/models/Player').Player}
		 */
		this.player = uuid
			? this.client.players.cache.get(uuid) ?? logger.error(`[HYPIXEL AUTHOR CTOR]: unknown uuid '${uuid}'`) ?? this.client.players.findByIgn(ign)
			: this.client.players.findByIgn(ign);
		/**
		 * @type {?import('discord.js').GuildMember}
		 */
		this.member = null;
	}

	get client() {
		return this.chatBridge.client;
	}

	/**
	 * set player and member
	 */
	async init() {
		try {
			if (!this.player) {
				// check mojang API / cache for the uuid associated with that ign
				const { uuid } = await mojang.ign(this.ign);
				this.player = this.client.players.cache.get(uuid) ?? logger.error(`[HYPIXEL AUTHOR INIT]: unknown uuid '${uuid}'`);
			}

			this.member = await this.player?.discordMember;
		} catch (error) {
			logger.error('[AUTHOR PLAYER]', error);
		}
	}

	/**
	 * whisper a message to the author
	 * @param {string | import('./ChatBridge').ChatOptions} contentOrOptions
	 */
	async send(contentOrOptions) {
		const { prefix = '', ...options } = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		return this.chatBridge.minecraft.chat({
			prefix: `/w ${this.ign} ${prefix}${prefix.length ? ' ' : ''}`,
			maxParts: Infinity,
			...options,
		});
	}

	/**
	 * player IGN
	 */
	toString() {
		return this.ign;
	}
}
