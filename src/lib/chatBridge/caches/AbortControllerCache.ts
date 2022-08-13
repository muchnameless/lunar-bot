import { setInterval } from 'node:timers';
import { SnowflakeUtil } from 'discord.js';
import { minutes } from '#functions';
import { BaseCache } from './BaseCache';
import type { Message, Snowflake } from 'discord.js';

export class AbortControllerCache extends BaseCache<AbortController> {
	protected static override _maxAge = minutes(5);
	protected _sweepInterval = setInterval(() => this.sweep(), minutes(10));

	/**
	 * returns either the cached or a new AbortController
	 * @param messageId
	 */
	get(messageId: Snowflake) {
		return this._cache.ensure(messageId, () => new AbortController());
	}

	/**
	 * aborts either the cached AbortController or creates a new one (if the message is not too old) and aborts it
	 * @param message
	 * @param reason
	 */
	abort(message: Pick<Message, 'id' | 'createdTimestamp'>, reason?: unknown) {
		let abortController = this._cache.get(message.id);

		if (!abortController && Date.now() - message.createdTimestamp > AbortControllerCache._maxAge) return null;

		(abortController ??= new AbortController()).abort(reason);

		this._cache.set(message.id, abortController);

		return abortController;
	}

	/**
	 * deletes the cached AbortController
	 * @param messageId
	 */
	delete(messageId: Snowflake) {
		return this._cache.delete(messageId);
	}

	/**
	 * sweeps the AbortController cache and deletes all that were created before the max age
	 */
	sweep() {
		return this._cache.sweep(
			(_, messageId) => Date.now() - SnowflakeUtil.timestampFrom(messageId) > AbortControllerCache._maxAge,
		);
	}
}
