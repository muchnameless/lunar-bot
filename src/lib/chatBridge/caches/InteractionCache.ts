import { type ChatInputCommandInteraction, type Snowflake } from 'discord.js';
import { BaseCache } from './BaseCache.js';
import { minutes } from '#functions';

export class InteractionCache extends BaseCache<ChatInputCommandInteraction<'cachedOrDM'>> {
	protected static override readonly _maxAge = minutes(15);

	/**
	 * adds the interaction to the cache if the channel is a chat bridge channel
	 *
	 * @param interaction
	 */
	public add(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
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
		return this._cache.sweep(({ createdTimestamp }) => Date.now() - createdTimestamp > InteractionCache._maxAge);
	}
}
