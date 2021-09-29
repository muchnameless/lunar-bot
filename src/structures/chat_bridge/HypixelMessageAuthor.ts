import { mojang } from '../../api/mojang';
import { logger } from '../../functions';
import type { GuildMember } from 'discord.js';
import type { ChatBridge, ChatOptions } from './ChatBridge';
import type { Player } from '../database/models/Player';


export class HypixelMessageAuthor {
	chatBridge: ChatBridge;
	ign: string;
	guildRank: string | null;
	player: Player | null;
	member: GuildMember | null;

	/**
	 * @param chatBridge
	 * @param param1
	 */
	constructor(chatBridge: ChatBridge, { ign, guildRank, uuid }: { ign: string, guildRank: string | null, uuid?: string | null }) {
		this.chatBridge = chatBridge;
		this.ign = ign ?? null;
		this.guildRank = guildRank ?? null;

		/**
		 * player object of the message author
		 */
		this.player = uuid
			? this.client.players.cache.get(uuid) ?? logger.error(`[HYPIXEL AUTHOR CTOR]: unknown uuid '${uuid}'`) ?? this.client.players.findByIgn(ign)
			: this.client.players.findByIgn(ign);
		/**
		 * discord guild member
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

			this.member = await this.player?.discordMember ?? null;
		} catch (error) {
			logger.error('[AUTHOR PLAYER]', error);
		}
	}

	/**
	 * whisper a message to the author
	 * @param contentOrOptions
	 */
	async send(contentOrOptions: string | ChatOptions) {
		const { prefix = '', ...options } = typeof contentOrOptions === 'string'
			? { content: contentOrOptions }
			: contentOrOptions;

		return this.chatBridge.minecraft.chat({
			prefix: `/w ${this.ign} ${prefix}${prefix.length ? ' ' : ''}`,
			maxParts: Number.POSITIVE_INFINITY,
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
