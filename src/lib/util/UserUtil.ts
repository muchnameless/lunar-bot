import { EmbedLimits, MessageLimits } from '@sapphire/discord-utilities';
import { DiscordAPIError, RESTJSONErrorCodes, type Message, type MessageCreateOptions, type User } from 'discord.js';
import { EmbedUtil } from './index.js';
import { redis } from '#api';
import { hours } from '#functions';
import { logger } from '#logger';
import type { Player } from '#structures/database/models/Player.js';

export interface SendDMOptions extends MessageCreateOptions {
	/**
	 * defaults to 1 hour
	 */
	cooldown?: number;
	/**
	 * identifier used to prevent multiple DMs of the same type within `cooldown` ms
	 */
	redisKey?: string;
	rejectOnError?: boolean;
}

export class UserUtil extends null {
	/**
	 * cache
	 */
	private static readonly PLAYER_CACHE = new WeakMap<User, Player>();

	/**
	 * @param user
	 */
	public static logInfo(user: User) {
		return {
			userId: user.id,
			tag: user.tag,
			bot: user.bot,
		};
	}

	/**
	 * @param user
	 */
	public static getPlayer(user?: User | null) {
		const player = this.PLAYER_CACHE.get(user!) ?? null;
		if (player || !user) return player;

		return this.setPlayer(user, user.client.players.getById(user.id) ?? user.client.players.getById(user.tag));
	}

	/**
	 * @param user
	 * @param player
	 */
	public static setPlayer(user: User, player: Player | null) {
		if (player) {
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
	public static async sendDM(user: User, options: SendDMOptions & { rejectOnError: true }): Promise<Message>;
	public static async sendDM(user: User, options: SendDMOptions | string): Promise<Message | null>;
	public static async sendDM(user: User, options: SendDMOptions | string): Promise<Message | null> {
		const { cooldown, redisKey, ..._options } =
			typeof options === 'string' ? ({ content: options } as SendDMOptions) : options;

		// can't DM bots
		if (user.bot) {
			const MESSAGE = `${user.tag} | ${user.id} is a bot and can't be DMed`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn({ user: this.logInfo(user), data: _options }, `[USER SEND DM]: ${MESSAGE}`);
			return null;
		}

		const keysToCheck = [`dm:${user.id}:closed`];
		if (redisKey) keysToCheck.push(redisKey);
		if (!user.dmChannel) keysToCheck.push('dm:channel:creation:error');

		// user had DMs closed or has already been DMed recently
		if (await redis.exists(...keysToCheck)) {
			const MESSAGE = `aborted DMing ${user.tag} | ${user.id}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn({ user: this.logInfo(user), data: _options }, `[USER SEND DM]: ${MESSAGE}`);
			return null;
		}

		if (_options.embeds) {
			if (_options.embeds.length > MessageLimits.MaximumEmbeds) {
				const MESSAGE = `embeds length ${_options.embeds.length} > ${MessageLimits.MaximumEmbeds}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ user: this.logInfo(user), data: _options }, `[USER SEND DM]: ${MESSAGE}`);
				return null;
			}

			const TOTAL_LENGTH = EmbedUtil.totalLength(_options.embeds);

			if (TOTAL_LENGTH > EmbedLimits.MaximumTotalCharacters) {
				const MESSAGE = `embeds total char length ${TOTAL_LENGTH} > ${EmbedLimits.MaximumTotalCharacters}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ user: this.logInfo(user), data: _options }, `[USER SEND DM]: ${MESSAGE}`);
				return null;
			}
		}

		if ((_options.content?.length ?? 0) > MessageLimits.MaximumLength) {
			const MESSAGE = `content length ${_options.content!.length} > ${MessageLimits.MaximumLength}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn({ user: this.logInfo(user), data: _options }, `[USER SEND DM]: ${MESSAGE}`);
			return null;
		}

		try {
			return await user.send(_options);
		} catch (error) {
			if (error instanceof DiscordAPIError) {
				switch (error.code) {
					case RESTJSONErrorCodes.CannotSendMessagesToThisUser:
						void redis.psetex(`dm:${user.id}:closed`, hours(1), 1);
						break;

					case RESTJSONErrorCodes.OpeningDirectMessagesTooFast:
						void redis.psetex('dm:channel:creation:error', hours(1), 1);
						break;

					default:
				}
			}

			if (_options.rejectOnError) throw error;
			logger.error({ user: this.logInfo(user), err: error, data: _options }, '[USER SEND DM]');
			return null;
		} finally {
			if (redisKey) void redis.psetex(redisKey, cooldown ?? hours(1), 1);
		}
	}
}
