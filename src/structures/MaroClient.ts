import { setTimeout } from 'node:timers';
import fetch from 'node-fetch';
import { logger, seconds } from '../functions';
import { FetchError } from './errors/FetchError';
import type { RequestInit, Response } from 'node-fetch';
import type { Components } from '@zikeji/hypixel';

export type MaroPlayerData = Components.Schemas.SkyBlockProfileMember & {
	banking?: Components.Schemas.SkyBlockProfileBanking;
};

interface MaroFetchOptions {
	cache?: boolean;
	force?: boolean;
}

interface Cache {
	get(key: string): Promise<unknown | undefined>;
	set(key: string, value: unknown): Promise<true>;
}

interface MaroClientOptions {
	cache?: Cache;
	timeout?: number;
	retries?: number;
	fetchPlayerData?: FetchPlayerData;
}

export type MaroAPIResponse =
	| {
			status: 200;
			data: unknown;
	  }
	| {
			status: number;
			cause: string;
	  };

export interface MaroNetworthResponse {
	total: number;
	purse?: number;
	body?: number;
}

interface SkyBlockItem {
	id: string;
	name: string;
	price: number;
	recomb?: boolean;
	count: number;
}

interface NetworthCategory {
	total: number;
	top_items: SkyBlockItem[];
}

export interface MaroNetworthCategoryResponse {
	categories: {
		storage: NetworthCategory;
		inventory: NetworthCategory;
		enderchest: NetworthCategory;
		armor: NetworthCategory;
		wardrobe_inventory: NetworthCategory;
		pets: NetworthCategory;
		talismans: NetworthCategory;
	};
	bank?: number;
	purse?: number;
	sacks: number;
	networth: number;
}

type FetchPlayerData = (uuid: string) => Promise<MaroPlayerData>;

abstract class Method {
	client: MaroClient;

	constructor(client: MaroClient) {
		this.client = client;
	}
}

class Networth extends Method {
	async categories(uuid: string, playerData?: MaroPlayerData, options?: MaroFetchOptions) {
		return this.client.request(
			'networth/categories',
			{
				method: 'POST',
				body: JSON.stringify({
					data: playerData ?? (await this.client.fetchPlayerData(uuid)),
				}),
				headers: {
					'Content-Type': 'application/json',
				},
			},
			{
				cacheKey: `networth:categories:${uuid}`,
				...options,
			},
		) as Promise<MaroNetworthCategoryResponse>;
	}

	async total(uuid: string, playerData?: MaroPlayerData, options?: MaroFetchOptions) {
		return this.client.request(
			'networth/total',
			{
				method: 'POST',
				body: JSON.stringify({
					data: playerData ?? (await this.client.fetchPlayerData(uuid)),
				}),
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
	baseURL = 'https://nariah-dev.com/api/';
	networth = new Networth(this);
	fetchPlayerData: FetchPlayerData;

	/**
	 * @param options
	 */
	constructor({ cache, timeout, retries, fetchPlayerData }: MaroClientOptions = {}) {
		this.cache = cache;
		this.timeout = timeout ?? seconds(10);
		this.retries = retries ?? 1;
		this.fetchPlayerData =
			fetchPlayerData ??
			(() => {
				throw new Error('no playerData argument provided and no fetchPlayerData method implemented');
			});
	}

	/**
	 * @param endpoint
	 * @param requestOptions
	 * @param options
	 */
	async request(
		endpoint: string,
		requestOptions: RequestInit,
		{ cacheKey, force = false, cache = true }: MaroFetchOptions & { cacheKey: string },
	) {
		if (!force) {
			const cached = (await this.cache?.get(cacheKey)) as Record<string, string>;

			if (cached) {
				if (Reflect.has(cached, 'cause')) {
					const { statusText, cause, ...res } = cached;

					throw new FetchError(
						'MaroAPIError',
						{
							statusText: statusText ? `${statusText} (cached error)` : 'cached error',
							...res,
						},
						cause,
					);
				}

				return cached;
			}
		}

		const res = await this._request(endpoint, requestOptions);

		switch (res.status) {
			case 200: {
				// Successfull request
				const { data } = (await res.json()) as { data: unknown };

				// cache successfull response
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
				let cause: string | undefined;

				try {
					({ cause } = (await res.json()) as { cause: string });
				} catch (error) {
					logger.error(error, '[MARO API]: json');
				}

				// cache error response
				if (cache) this.cache?.set(cacheKey, { status: res.status, statusText: res.statusText, cause });

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
	private async _request(endpoint: string, options: RequestInit, retries = 0): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(`${this.baseURL}${endpoint}`, {
				signal: controller.signal,
				...options,
			});
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if (error instanceof Error && error.name === 'AbortError' && retries !== this.retries) {
				return this._request(endpoint, options, retries + 1);
			}

			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}
