import { type CommandInteraction, type Snowflake } from 'discord.js';
import { BaseCache } from './BaseCache.js';
import { minutes } from '#functions';

export class OwnInteractionCache extends BaseCache<CommandInteraction<'cachedOrDM'>> {
	protected static override readonly _maxAge = minutes(15);

	/**
	 * adds the interaction to the cache if the channel is a chat bridge channel
	 *
	 * @param interaction
	 */
	public add(interaction: CommandInteraction<'cachedOrDM'>) {
		this._cache.set(interaction.id, interaction);
	}

	/**
	 * retrieves an interaction from the cache and deletes it from the cache if found
	 *
	 * @param interactionId
	 */
	public get(interactionId: Snowflake) {
		const cached = this._cache.get(interactionId);
		if (!cached) return null;

		this._cache.delete(interactionId);
		return cached;
	}

	/**
	 * sweeps the interaction cache and deletes all that were created before the max age
	 */
	public sweep() {
		if (!this._cache.size) return 0;

		const now = Date.now();

		return this._cache.sweep(({ createdTimestamp }) => now - createdTimestamp > OwnInteractionCache._maxAge);
	}
}
