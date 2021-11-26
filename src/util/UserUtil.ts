import { logger } from '../functions';
import type { Message, MessageOptions, User } from 'discord.js';
import type { Player } from '../structures/database/models/Player';
import type { LunarClient } from '../structures/LunarClient';

export default class UserUtil extends null {
	/**
	 * cache
	 */
	static PLAYER_CACHE = new WeakMap<User, Player>();

	/**
	 * @param user
	 */
	static getPlayer(user?: User) {
		const player = this.PLAYER_CACHE.get(user!) ?? null;
		if (player || !user) return player;

		return this.setPlayer(
			user,
			(user.client as LunarClient).players.getById(user.id) ?? (user.client as LunarClient).players.getById(user.tag),
		);
	}

	/**
	 * @param user
	 * @param player
	 */
	static setPlayer(user: User, player: Player | null) {
		if (player != null) {
			this.PLAYER_CACHE.set(user, player);
		} else {
			this.PLAYER_CACHE.delete(user);
		}

		return player;
	}

	/**
	 * @param user
	 * @param contentOrOptions
	 */
	static async sendDM(user: User, contentOrOptions: MessageOptions & { rejectOnError: true }): Promise<Message>;
	static async sendDM(
		user: User,
		contentOrOptions: string | (MessageOptions & { rejectOnError?: boolean }),
	): Promise<Message | null>;
	static async sendDM(user: User, contentOrOptions: string | (MessageOptions & { rejectOnError?: boolean })) {
		if (user.bot) {
			if (typeof contentOrOptions !== 'string' && contentOrOptions.rejectOnError) {
				throw new Error(`${user.tag} | ${user.id} is a bot and can't be DMed`);
			}

			logger.warn(`${user.tag} | ${user.id} is a bot and can't be DMed`);
			return null;
		}

		try {
			return await user.send(contentOrOptions);
		} catch (error) {
			if (typeof contentOrOptions !== 'string' && contentOrOptions.rejectOnError) throw error;
			logger.error(error, `[SEND DM]: ${user.tag} | ${user.id}`);
			return null;
		}
	}
}
