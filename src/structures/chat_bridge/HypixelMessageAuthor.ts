import { mojang } from '../../api';
import { logger } from '../../functions';
import type { GuildMember } from 'discord.js';
import type { ChatBridge, ChatOptions } from './ChatBridge';
import type { Player } from '../database/models/Player';

interface AuthorData {
	ign: string;
	guildRank?: string | null;
	uuid?: string | null;
}

export class HypixelMessageAuthor {
	chatBridge: ChatBridge;
	ign: string;
	guildRank: string | null;
	/**
	 * player object of the message author
	 */
	player: Player | null;
	/**
	 * discord guild member
	 */
	member: GuildMember | null = null;

	/**
	 * @param chatBridge
	 * @param data
	 */
	constructor(chatBridge: ChatBridge, { ign, guildRank, uuid }: AuthorData) {
		this.chatBridge = chatBridge;
		this.ign = ign;
		this.guildRank = guildRank ?? null;
		this.player = uuid
			? this.client.players.cache.get(uuid) ??
			  logger.error(`[HYPIXEL AUTHOR CTOR]: unknown uuid '${uuid}'`) ??
			  this.client.players.findByIgn(ign)
			: this.client.players.findByIgn(ign);
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
				this.player =
					this.client.players.cache.get(uuid) ?? (logger.error(`[HYPIXEL AUTHOR INIT]: unknown uuid '${uuid}'`), null);
			}

			this.member = (await this.player?.discordMember) ?? null;
		} catch (error) {
			logger.error(error, '[AUTHOR PLAYER]');
		}
	}

	/**
	 * whisper a message to the author
	 * @param contentOrOptions
	 */
	send(contentOrOptions: string | ChatOptions) {
		const { prefix = '', ...options } =
			typeof contentOrOptions === 'string' ? { content: contentOrOptions } : contentOrOptions;

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
