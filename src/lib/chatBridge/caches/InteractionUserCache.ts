import { minutes } from '#functions';
import { BaseCache } from './BaseCache';
import type { Snowflake } from 'discord.js';
import type { RepliableInteraction } from '#utils';

export class InteractionUserCache extends BaseCache<RepliableInteraction> {
	protected static override _maxAge = minutes(15);

	constructor() {
		super(minutes(15));
	}

	/**
	 * adds the interaction to the cache if the channel is a chat bridge channel
	 * @param interaction
	 */
	add(interaction: RepliableInteraction) {
		this._cache.set(interaction.user.id, interaction);
	}

	/**
	 * retrieves an interaction from the cache if it has not been expired yet
	 * @param userId
	 */
	get(userId: Snowflake) {
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
	 * @param userId
	 */
	delete(userId: Snowflake) {
		return this._cache.delete(userId);
	}

	/**
	 * sweeps the interaction cache and deletes all that were created before the max age
	 */
	protected _sweep() {
		return this._cache.sweep(({ createdTimestamp }) => Date.now() - createdTimestamp > InteractionUserCache._maxAge);
	}
}
