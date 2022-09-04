import { clearTimeout, setTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { AsyncQueue } from '@sapphire/async-queue';
import { RateLimitManager } from '@sapphire/ratelimits';
import { fetch, type Response } from 'undici';
import { MojangAPIError } from './errors/MojangAPIError.js';
import {
	// days,
	consumeBody,
	isAbortError,
	minutes,
	seconds,
	validateMinecraftIgn,
	validateMinecraftUuid,
} from '#functions';

export interface MojangResult {
	ign: string;
	uuid: string;
}

export interface MojangFetchOptions {
	cache?: boolean;
	force?: boolean;
	signal?: AbortSignal;
}

interface InternalMojangFetchOptions extends MojangFetchOptions {
	path: string;
	query: string;
	queryType?: string | null;
}

interface Cache {
	get(key: string): Promise<(MojangResult & { error?: boolean; status?: number; statusText?: string }) | null>;
	set(
		key: string,
		value: MojangResult | { error: boolean; status: number; statusText: string },
		isError?: boolean,
	): Promise<unknown>;
}

interface MojangClientOptions {
	cache?: Cache;
	rateLimitResetOffset?: number;
	retries?: number;
	timeout?: number;
}

export class MojangClient {
	/**
	 * https://wiki.vg/Mojang_API
	 * https://c4k3.github.io/wiki.vg/Mojang_API.html#Notes
	 */
	public readonly rateLimitManager = new RateLimitManager(minutes(10), 600);

	public readonly queue = new AsyncQueue();

	private readonly cache?: Cache;

	private readonly rateLimitResetOffset: number;

	private readonly timeout: number;

	private readonly retries: number;

	/**
	 * @param options
	 */
	public constructor({ cache, rateLimitResetOffset, timeout, retries }: MojangClientOptions = {}) {
		this.cache = cache;
		this.rateLimitResetOffset = rateLimitResetOffset ?? seconds(1);
		this.retries = retries ?? 3;
		this.timeout = timeout ?? seconds(20);
	}

	/**
	 * bulk convertion (1 <= amount  <= 10) for ign -> uuid
	 *
	 * @param usernames
	 * @param options
	 */
	public async igns(usernames: string[], options?: MojangFetchOptions): Promise<MojangResult[]> {
		if (!usernames.length || usernames.length > 10) {
			throw new MojangAPIError({ statusText: `received ${usernames.length} usernames, must be between 1 and 10` });
		}

		const res = await fetch('https://api.mojang.com/profiles/minecraft', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(usernames),
		});

		if (res.status !== 200) {
			void consumeBody(res);
			throw new MojangAPIError(res);
		}

		const responses: MojangResult[] = ((await res.json()) as { id: string; name: string }[]).map(({ id, name }) => ({
			uuid: id,
			ign: name,
		}));

		if (options?.cache) {
			for (const response of responses) {
				void this.cache?.set(`ign:${response.ign.toLowerCase()}`, response);
				void this.cache?.set(`uuid:${response.uuid}`, response);
			}
		}

		return responses;
	}

	/**
	 * query by ign
	 *
	 * @param ign
	 * @param options
	 */
	public async ign(ign: string, options?: MojangFetchOptions) {
		if (validateMinecraftIgn(ign)) {
			return this.request({
				path: 'https://api.mojang.com/users/profiles/minecraft/',
				query: ign.toLowerCase(),
				queryType: 'ign',
				...options,
			});
		}

		throw new MojangAPIError({ statusText: 'validation' }, 'ign', ign);
	}

	/**
	 * query by uuid
	 *
	 * @param uuid
	 * @param options
	 */
	public async uuid(uuid: string, options?: MojangFetchOptions) {
		if (validateMinecraftUuid(uuid)) {
			return this.request({
				path: 'https://sessionserver.mojang.com/session/minecraft/profile/',
				query: uuid.toLowerCase().replaceAll('-', ''),
				queryType: 'uuid',
				...options,
			});
		}

		throw new MojangAPIError({ statusText: 'validation' }, 'uuid', uuid);
	}

	/**
	 * query by ign or uuid
	 *
	 * @param ignOrUuid
	 * @param options
	 */
	public async ignOrUuid(ignOrUuid: string, options?: MojangFetchOptions) {
		if (validateMinecraftIgn(ignOrUuid)) {
			return this.request({
				path: 'https://api.mojang.com/users/profiles/minecraft/',
				query: ignOrUuid.toLowerCase(),
				queryType: 'ign',
				...options,
			});
		}

		if (validateMinecraftUuid(ignOrUuid)) {
			return this.request({
				path: 'https://sessionserver.mojang.com/session/minecraft/profile/',
				query: ignOrUuid.toLowerCase().replaceAll('-', ''),
				queryType: 'uuid',
				...options,
			});
		}

		throw new MojangAPIError({ statusText: 'validation' }, 'ignOrUuid', ignOrUuid);
	}

	/**
	 * @param options
	 */
	public async request({
		path,
		query,
		queryType = null,
		cache = true,
		force = false,
		signal,
	}: InternalMojangFetchOptions): Promise<MojangResult> {
		const CACHE_KEY = `${queryType}:${query}`;

		if (!force) {
			const cachedResponse = await this.cache?.get(CACHE_KEY);

			if (cachedResponse) {
				if (cachedResponse.error) {
					throw new MojangAPIError(
						{
							statusText: cachedResponse.statusText ? `${cachedResponse.statusText} (cached error)` : 'cached error',
							...cachedResponse,
						},
						queryType,
						query,
					);
				}

				return cachedResponse;
			}
		}

		const res = await this._request(`${path}${query}`, signal);

		switch (res.status) {
			// success
			case 200: {
				const { id: uuid, name: ign } = (await res.json()) as { id: string; name: string };
				const response = { uuid, ign };

				if (cache) {
					void this.cache?.set(`ign:${ign.toLowerCase()}`, response);
					void this.cache?.set(`uuid:${uuid}`, response);
				}

				return response;
			}

			/**
			 * mojang api currently ignores ?at= [https://bugs.mojang.com/browse/WEB-3367]
			 */
			// invalid ign
			// case 204: {
			// 	if (queryType === 'ign') {
			// 		void consumeBody(res);

			// 		// retry a past date if name was queried
			// 		let timestamp = Date.now();

			// 		// igns can be changed every 30 days since 2015-02-04T00:00:00.000Z
			// 		while ((timestamp -= days(30)) >= Date.parse('2015-02-04T00:00:00.000Z')) {
			// 			const pastRes = await this._request(`${path}${query}?at=${timestamp}`, signal);

			// 			if (pastRes.status === 200) {
			// 				const { id: uuid, name: ign } = (await res.json()) as { id: string; name: string };
			// 				const response = { uuid, ign };

			// 				if (cache) {
			// 					// only cache ign -> uuid for outdated igns
			// 					void this.cache?.set(`ign:${ign.toLowerCase()}`, response);
			// 				}

			// 				return response;
			// 			}

			// 			void consumeBody(res);
			// 		}
			// 	}
			// }
			// falls through

			default:
				// only check cache if force === true, because otherwise cache is already checked before the request
				if (cache && (!force || !(await this.cache?.get(CACHE_KEY)))) {
					void this.cache?.set(CACHE_KEY, { error: true, status: res.status, statusText: res.statusText }, true);
				}

				void consumeBody(res);
				throw new MojangAPIError(res, queryType, query);
		}
	}

	/**
	 * @param url
	 * @param retries
	 */
	private async _request(url: string, signal: AbortSignal | undefined, retries = 0): Promise<Response> {
		const ratelimit = this.rateLimitManager.acquire('global');

		if (ratelimit.limited) {
			await this.queue.wait({ signal });

			if (ratelimit.limited) {
				try {
					await sleep(ratelimit.remainingTime + this.rateLimitResetOffset, null, { signal });
				} catch (error) {
					this.queue.shift();
					throw error;
				}
			}

			ratelimit.consume();
			this.queue.shift();
		} else {
			signal?.throwIfAborted();
			ratelimit.consume();
		}

		// internal AbortSignal (to have a timeout without having to abort the external signal)
		const controller = new AbortController();
		const listener = () => controller.abort();
		const timeout = setTimeout(listener, this.timeout);

		// external AbortSignal
		signal?.addEventListener('abort', listener);

		try {
			return await fetch(url, { signal: controller.signal });
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if (isAbortError(error) && retries !== this.retries) {
				return await this._request(url, signal, retries + 1);
			}

			throw error;
		} finally {
			clearTimeout(timeout);

			signal?.removeEventListener('abort', listener);
		}
	}
}
