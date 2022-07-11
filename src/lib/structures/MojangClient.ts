import { fetch } from 'undici';
import { ErrorCode } from '#constants';
import { /* days, */ consumeBody, seconds, validateMinecraftIgn, validateMinecraftUuid } from '#functions';
import { MojangAPIError } from './errors/MojangAPIError';
import type { Response } from 'undici';

export interface MojangResult {
	uuid: string;
	ign: string;
}

interface MojangFetchOptions {
	cache?: boolean;
	force?: boolean;
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
	timeout?: number;
	retries?: number;
}

export class MojangClient {
	cache?: Cache;
	timeout: number;
	retries: number;

	/**
	 * @param options
	 */
	constructor({ cache, timeout, retries }: MojangClientOptions = {}) {
		this.cache = cache;
		this.timeout = timeout ?? seconds(10);
		this.retries = retries ?? 1;
	}

	/**
	 * bulk convertion (1 <= amount  <= 10) for ign -> uuid
	 * @param usernames
	 * @param options
	 */
	async igns(usernames: string[], options?: MojangFetchOptions): Promise<MojangResult[]> {
		if (!usernames.length || usernames.length > 10) throw new MojangAPIError({ statusText: 'wrong input' });

		const res = await fetch('https://api.mojang.com/profiles/minecraft', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(usernames),
		});

		if (res.status !== 200) {
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
	 * @param ign
	 * @param options
	 */
	ign(ign: string, options?: MojangFetchOptions) {
		if (validateMinecraftIgn(ign)) {
			return this.request({
				path: 'https://api.mojang.com/users/profiles/minecraft/',
				query: ign.toLowerCase(),
				queryType: 'ign',
				...options,
			});
		}

		return Promise.reject(new MojangAPIError({ statusText: 'validation' }, 'ign', ign));
	}

	/**
	 * query by uuid
	 * @param uuid
	 * @param options
	 */
	uuid(uuid: string, options?: MojangFetchOptions) {
		if (validateMinecraftUuid(uuid)) {
			return this.request({
				path: 'https://sessionserver.mojang.com/session/minecraft/profile/',
				query: uuid.toLowerCase().replaceAll('-', ''),
				queryType: 'uuid',
				...options,
			});
		}

		return Promise.reject(new MojangAPIError({ statusText: 'validation' }, 'uuid', uuid));
	}

	/**
	 * query by ign or uuid
	 * @param ignOrUuid
	 * @param options
	 */
	ignOrUuid(ignOrUuid: string, options?: MojangFetchOptions) {
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

		return Promise.reject(new MojangAPIError({ statusText: 'validation' }, 'ignOrUuid', ignOrUuid));
	}

	/**
	 * @private
	 * @param options
	 */
	async request({
		path,
		query,
		queryType = null,
		cache = true,
		force = false,
	}: { path: string; query: string; queryType?: string | null } & MojangFetchOptions): Promise<MojangResult> {
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

		const res = await this._request(`${path}${query}`);

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
			// 			const pastRes = await this._request(`${path}${query}?at=${timestamp}`);

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
				void consumeBody(res);

				// only check cache if force === true, because otherwise cache is already checked before the request
				if (cache && (!force || !(await this.cache?.get(CACHE_KEY)))) {
					void this.cache?.set(CACHE_KEY, { error: true, status: res.status, statusText: res.statusText }, true);
				}

				throw new MojangAPIError(res, queryType, query);
		}
	}

	/**
	 * @param url
	 * @param retries
	 */
	private async _request(url: string, retries = 0): Promise<Response> {
		try {
			return await fetch(url, {
				// @ts-expect-error
				signal: AbortSignal.timeout(this.timeout),
			});
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if ((error as any)?.code === ErrorCode.AbortErr && retries !== this.retries) {
				return this._request(url, retries + 1);
			}

			throw error;
		}
	}
}
