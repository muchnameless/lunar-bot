import { mojang } from '../../api';
import { logger } from '../../logger';
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
					this.client.players.cache.get(uuid) ??
					logger.error(`[HYPIXEL AUTHOR INIT]: unknown uuid '${uuid}'`) ??
					(await this.client.players.fetch({ minecraftUuid: uuid }));
			}

			this.member = (await this.player?.fetchDiscordMember()) ?? null;
		} catch (error) {
			logger.error(error, '[AUTHOR PLAYER]');
		}
	}

	/**
	 * whisper a message to the author
	 * @param options
	 */
	send(options: string | ChatOptions) {
		const { prefix = '', ..._options } = typeof options === 'string' ? { content: options } : options;

		return this.chatBridge.minecraft.chat({
			prefix: `/w ${this.ign} ${prefix}${prefix.length ? ' ' : ''}`,
			maxParts: Number.POSITIVE_INFINITY,
			..._options,
		});
	}

	/**
	 * player IGN
	 */
	toString() {
		return this.ign;
	}
}
