import fetch from 'node-fetch';
import { FetchError } from './errors/FetchError';
import type { RequestInit, Response } from 'node-fetch';
import type { Components } from '@zikeji/hypixel';
import { logger, seconds } from '../functions';


export type MaroPlayerData = Components.Schemas.SkyBlockProfileMember & { banking?: Components.Schemas.SkyBlockProfileBanking };

interface MaroFetchOptions {
	cache?: boolean,
	force?: boolean,
}

interface Cache {
	get(key: string): Promise<unknown | undefined>;
	set(key: string, value: unknown): Promise<true>;
}

interface MaroClientOptions {
	cache?: Cache;
	timeout?: number;
	retries?: number;
}

export type MaroAPIResponse = {
	status: 200;
	data: unknown;
} | {
	status: number;
	cause: string;
}

export interface MaroNetworthResponse {
	total: number;
	purse?: number;
	body?: number;
}

export interface MaroNetwortCategoryResponse {
	categories: {
		storage: number;
		inventory: number;
		enderchest: number;
		armor: number;
		// eslint-disable-next-line camelcase
		wardrobe_inventory: number;
		pets: number;
		talismans: number;
	},
	bank?: number;
	purse?: number;
	sacks: number;
	networth: number;
}

abstract class Method {
	client: MaroClient;

	constructor(client: MaroClient) {
		this.client = client;
	}
}


class Networth extends Method {
	categories(uuid: string, playerData: MaroPlayerData, options?: MaroFetchOptions) {
		return this.client.request(
			'networth/categories',
			{
				method: 'POST',
				body: JSON.stringify({ data: playerData }),
				headers: {
					'Content-Type': 'application/json',
				},
			},
			{
				cacheKey: `networth:categories:${uuid}`,
				...options,
			},
		) as Promise<MaroNetwortCategoryResponse>;
	}

	total(uuid: string, playerData: MaroPlayerData, options?: MaroFetchOptions) {
		return this.client.request(
			'networth/total',
			{
				method: 'POST',
				body: JSON.stringify({ data: playerData }),
				headers: {
					'Content-Type': 'application/json',
				},
			},
			{
				cacheKey: `networth:total:${uuid}`,
				...options,
			},
		) as Promise<MaroNetworthResponse>;
	}
}


export class MaroClient {
	cache?: Cache;
	timeout: number;
	retries: number;
	#baseURL = 'https://nariah-dev.com/api/';
	networth = new Networth(this);

	/**
	 * @param options
	 */
	constructor({ cache, timeout, retries }: MaroClientOptions = {}) {
		this.cache = cache;
		this.timeout = timeout ?? seconds(10);
		this.retries = retries ?? 1;
	}

	/**
	 * @param endpoint
	 * @param requestOptions
	 * @param options
	 */
	async request(endpoint: string, requestOptions: RequestInit, { cacheKey, force = false, cache = true }: MaroFetchOptions & { cacheKey: string; }) {
		if (!force) {
			const cached = await this.cache?.get(cacheKey);
			if (cached) return cached;
		}

		const res = await this.#request(endpoint, requestOptions);

		switch (res.status) {
			case 200: { // Successfull request
				const { data } = await res.json() as { data: unknown; };

				// cache
				if (cache) this.cache?.set(cacheKey, data);

				return data;
			}

			// case 404: // Inventory is private
			// 	// throw new FetchError('MaroAPIError', res, 'inventory is private');
			// // fallthrough

			// case 400: // Malformed body
			// // fallthrough

			// case 500: // An internal error occured, you should report this by creating a support ticket
			// // fallthrough

			default: {
				let cause;

				try {
					({ cause } = await res.json() as { cause: string; });
				} catch (error) {
					logger.error('[MARO API]: json', error);
				}

				throw new FetchError('MaroAPIError', res, cause);
			}
		}
	}

	/**
	 * make request
	 * @param endpoint
	 * @param options
	 * @param retries current retry
	 */
	async #request(endpoint: string, options: RequestInit, retries = 0): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(
					`${this.#baseURL}${endpoint}`,
					{
						signal: controller.signal,
						...options,
					},
			);
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if (error instanceof Error && error.name === 'AbortError' && retries !== this.retries) {
				return this.#request(endpoint, options, retries + 1);
			}

			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}
