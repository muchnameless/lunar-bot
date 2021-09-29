import { logger } from '../functions';
import type { MessageOptions, User } from 'discord.js';
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
		let player = this.PLAYER_CACHE.get(user!) ?? null;
		if (player || !user) return player;

		player = (user.client as LunarClient).players.getById(user.id) ?? (user.client as LunarClient).players.getById(user.tag);
		if (player) this.setPlayer(user, player);
		return player;
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
	}

	/**
	 * @param user
	 * @param contentOrOptions
	 */
	static async sendDM(user: User, contentOrOptions: string | MessageOptions) {
		if (user.bot) return logger.warn(`${user.tag} is a bot and can't be DMed`);

		try {
			return await user.send(contentOrOptions);
		} catch (error) {
			return logger.error(error);
		}
	}
}
