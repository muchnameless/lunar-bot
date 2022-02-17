import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { hours, logger } from '../functions';
import { EMBEDS_MAX_AMOUNT, EMBED_MAX_CHARS, MESSAGE_MAX_CHARS } from '../constants';
import { cache } from '../api';
import type { Embed, Message, MessageOptions, User } from 'discord.js';
import type { Player } from '../structures/database/models/Player';

interface _SendDMOptions extends MessageOptions {
	rejectOnError?: boolean;
	embeds?: Embed[];
}

export type SendDMOptions = _SendDMOptions &
	({ redisKey: string; cooldown: number } | { redisKey?: null; cooldown?: null });

export class UserUtil extends null {
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

		return this.setPlayer(user, user.client.players.getById(user.id) ?? user.client.players.getById(user.tag));
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
	 * @param options
	 */
	static async sendDM(user: User, options: SendDMOptions & { rejectOnError: true }): Promise<Message>;
	static async sendDM(user: User, options: string | SendDMOptions): Promise<Message | null>;
	static async sendDM(user: User, options: string | SendDMOptions) {
		const {
			cooldown = null,
			redisKey = null,
			..._options
		} = typeof options === 'string' ? ({ content: options } as SendDMOptions) : options;

		// can't DM bots
		if (user.bot) {
			const MESSAGE = `[USER SEND DM]: ${user.tag} | ${user.id} is a bot and can't be DMed`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(_options, MESSAGE);
			return null;
		}

		// user had DMs closed
		if (await cache.get(`dm:${user.id}:closed`)) {
			const MESSAGE = `[USER SEND DM]: ${user.tag} had their DMs closed`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(_options, MESSAGE);
			return null;
		}

		// user has already been DMed recently
		if (redisKey && (await cache.get(redisKey))) {
			const MESSAGE = `[USER SEND DM]: DMing ${user.tag} is currently on cooldown`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(_options, MESSAGE);
			return null;
		}

		if (Reflect.has(_options, 'embeds')) {
			if (_options.embeds!.length > EMBEDS_MAX_AMOUNT) {
				const MESSAGE = `[USER SEND DM]: embeds length ${_options.embeds!.length} > ${EMBEDS_MAX_AMOUNT}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn(_options, MESSAGE);
				return null;
			}

			const TOTAL_LENGTH = _options.embeds!.reduce((acc, cur) => acc + cur.length, 0);

			if (TOTAL_LENGTH > EMBED_MAX_CHARS) {
				const MESSAGE = `[USER SEND DM]: embeds total char length ${TOTAL_LENGTH} > ${EMBED_MAX_CHARS}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn(_options, MESSAGE);
				return null;
			}
		}

		if ((_options.content?.length ?? 0) > MESSAGE_MAX_CHARS) {
			const MESSAGE = `[USER SEND DM]: content length ${_options.content!.length} > ${MESSAGE_MAX_CHARS}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(_options, MESSAGE);
			return null;
		}

		try {
			return await user.send(_options);
		} catch (error) {
			if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
				cache.set(`dm:${user.id}:closed`, true, hours(1));
			}

			if (_options.rejectOnError) throw error;
			logger.error(error, `[USER SEND DM]: ${user.tag} | ${user.id}`);
			return null;
		} finally {
			if (redisKey && cooldown) cache.set(redisKey, true, cooldown);
		}
	}
}
