import { SnowflakeUtil, type MessageInteraction, type Snowflake } from 'discord.js';
import { minutes } from '#functions';

export class OtherBotInteractionCache {
	private static readonly _maxAge = minutes(15);

	private static readonly _maxSize = 200;

	private readonly _cache = new Set<Snowflake>();

	/**
	 * adds the interaction to the cache if the channel is a chat bridge channel
	 *
	 * @param interaction
	 */
	public add(interaction: MessageInteraction) {
		if (this._cache.size >= OtherBotInteractionCache._maxSize) this._cache.delete(this._cache.values().next().value);

		this._cache.add(interaction.id);
	}

	/**
	 * retrieves an interaction from the cache and deletes it from the cache if found
	 *
	 * @param interactionId
	 */
	public get(interactionId: Snowflake) {
		return this._cache.delete(interactionId);
	}

	/**
	 * sweeps the interaction cache and deletes all that were created before the max age
	 */
	public sweep() {
		if (!this._cache.size) return;

		const now = Date.now();

		for (const interactionId of this._cache) {
			if (now - SnowflakeUtil.timestampFrom(interactionId) > OtherBotInteractionCache._maxAge) {
				this._cache.delete(interactionId);
			}
		}
	}
}
