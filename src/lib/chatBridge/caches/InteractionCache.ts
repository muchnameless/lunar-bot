import { minutes } from '#functions';
import { BaseCache } from './BaseCache';
import type { ChatInputCommandInteraction, Snowflake } from 'discord.js';

export class InteractionCache extends BaseCache<ChatInputCommandInteraction<'cachedOrDM'>> {
	protected static override _maxAge = minutes(15);

	constructor() {
		super(minutes(15));
	}

	/**
	 * adds the interaction to the cache if the channel is a chat bridge channel
	 * @param interaction
	 */
	add(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		this._cache.set(interaction.id, interaction);
	}

	/**
	 * retrieves an interaction from the cache and deletes it from the cache if found
	 * @param interactionId
	 */
	get(interactionId: Snowflake) {
		const cached = this._cache.get(interactionId);
		if (!cached) return null;

		this._cache.delete(interactionId);
		return cached;
	}

	/**
	 * sweeps the interaction cache and deletes all that were created before the max age
	 */
	protected _sweep() {
		return this._cache.sweep(({ createdTimestamp }) => Date.now() - createdTimestamp > InteractionCache._maxAge);
	}
}
