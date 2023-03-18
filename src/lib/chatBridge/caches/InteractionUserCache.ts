import type { Snowflake } from 'discord.js';
import { BaseCache } from './BaseCache.js';
import { minutes } from '#functions';
import type { RepliableInteraction } from '#utils';

export class InteractionUserCache extends BaseCache<RepliableInteraction> {
	protected static override readonly _maxAge = minutes(15);

	/**
	 * adds the interaction to the cache if the channel is a chat bridge channel
	 *
	 * @param interaction
	 */
	public add(interaction: RepliableInteraction) {
		this._cache.set(interaction.user.id, interaction);
	}

	/**
	 * retrieves an interaction from the cache if it has not been expired yet
	 *
	 * @param userId
	 */
	public get(userId: Snowflake) {
		const cached = this._cache.get(userId);
		if (!cached) return null;

		if (Date.now() - cached.createdTimestamp > InteractionUserCache._maxAge) {
			this._cache.delete(userId);
			return null;
		}

		return cached;
	}

	/**
	 * deletes the cached interaction
	 *
	 * @param userId
	 */
	public delete(userId: Snowflake) {
		return this._cache.delete(userId);
	}

	/**
	 * sweeps the interaction cache and deletes all that were created before the max age
	 */
	public sweep() {
		if (!this._cache.size) return 0;

		const now = Date.now();

		return this._cache.sweep(({ createdTimestamp }) => now - createdTimestamp > InteractionUserCache._maxAge);
	}
}
