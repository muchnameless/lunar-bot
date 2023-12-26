import { setInterval } from 'node:timers';
import { SnowflakeUtil, type Message, type Snowflake } from 'discord.js';
import { BaseCache } from './BaseCache.js';
import { minutes } from '#functions';

export class AbortControllerCache extends BaseCache<AbortController> {
	protected static override readonly _maxAge = minutes(5);

	// eslint-disable-next-line unicorn/consistent-function-scoping
	protected readonly _sweepInterval = setInterval(() => this.sweep(), minutes(5));

	/**
	 * returns either the cached or a new AbortController
	 *
	 * @param messageId
	 */
	public get(messageId: Snowflake) {
		return this._cache.ensure(messageId, () => new AbortController());
	}

	/**
	 * aborts either the cached AbortController or creates a new one (if the message is not too old) and aborts it
	 *
	 * @param message
	 * @param reason
	 */
	public abort(message: Pick<Message, 'createdTimestamp' | 'id'>, reason?: unknown) {
		let abortController = this._cache.get(message.id);

		if (!abortController && Date.now() - message.createdTimestamp > AbortControllerCache._maxAge) return null;

		(abortController ??= new AbortController()).abort(reason);

		this._cache.set(message.id, abortController);

		return abortController;
	}

	/**
	 * deletes the cached AbortController
	 *
	 * @param messageId
	 */
	public delete(messageId: Snowflake) {
		return this._cache.delete(messageId);
	}

	/**
	 * sweeps the AbortController cache and deletes all that were created before the max age
	 */
	public sweep() {
		if (!this._cache.size) return 0;

		const now = Date.now();

		return this._cache.sweep(
			(_, messageId) => now - SnowflakeUtil.timestampFrom(messageId) > AbortControllerCache._maxAge,
		);
	}
}
