import type { GuildMember } from 'discord.js';
import type { ChatBridge } from './ChatBridge.js';
import type { MinecraftChatOptions } from './managers/MinecraftChatManager.js';
import { mojang } from '#api';
import { logger } from '#logger';
import type { Player } from '#structures/database/models/Player.js';

type AuthorData = {
	guildRank?: string | null;
	ign: string;
	uuid?: string | null;
};

export class HypixelMessageAuthor {
	public readonly chatBridge: ChatBridge;

	public readonly ign: string;

	public readonly guildRank: string | null;

	/**
	 * player object of the message author
	 */
	public player: Player | null;

	/**
	 * discord guild member
	 */
	public member: GuildMember | null = null;

	/**
	 * @param chatBridge
	 * @param data
	 */
	public constructor(chatBridge: ChatBridge, { ign, guildRank, uuid }: AuthorData) {
		this.chatBridge = chatBridge;
		this.ign = ign;
		this.guildRank = guildRank ?? null;
		this.player = uuid
			? this.client.players.cache.get(uuid) ??
			  logger.error({ ign, uuid }, '[HYPIXEL AUTHOR CTOR]: unknown uuid') ??
			  this.client.players.findByIgn(ign)
			: this.client.players.findByIgn(ign);
	}

	public get client() {
		return this.chatBridge.client;
	}

	/**
	 * set player and member
	 */
	public async init() {
		try {
			if (!this.player) {
				// check mojang API / cache for the uuid associated with that ign
				const { uuid } = await mojang.ign(this.ign);
				this.player =
					this.client.players.cache.get(uuid) ??
					logger.error({ ign: this.ign, uuid }, '[HYPIXEL AUTHOR INIT]: unknown uuid') ??
					(await this.client.players.fetch({ minecraftUuid: uuid }));
			}

			this.member = (await this.player?.fetchDiscordMember()) ?? null;
		} catch (error) {
			logger.error({ err: error, ign: this.ign }, '[AUTHOR PLAYER]');
		}
	}

	/**
	 * whisper a message to the author
	 *
	 * @param options
	 */
	public async send(options: MinecraftChatOptions | string) {
		return this.chatBridge.minecraft.whisper(this.ign, options);
	}

	/**
	 * returns @IGN
	 */
	public toString() {
		return `@${this.ign}`;
	}
}
