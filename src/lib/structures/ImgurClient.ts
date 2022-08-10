import { setTimeout as sleep } from 'node:timers/promises';
import { AsyncQueue } from '@sapphire/async-queue';
import { fetch, FormData } from 'undici';
import ms from 'ms';
import { logger } from '#logger';
import { ErrorCode } from '#constants';
import { consumeBody, seconds } from '#functions';
import { keys } from '#types';
import { FetchError } from './errors/FetchError';
import type { ErrorWithCode } from '../types/error';
import type { RequestInit, Response } from 'undici';

export interface ImageData {
	id: string;
	title: string | null;
	description: string | null;
	datetime: number;
	type: string;
	animated: boolean;
	width: number;
	height: number;
	size: number;
	views: number;
	bandwidth: number;
	vote: unknown | null;
	favorite: boolean;
	nsfw: boolean | null;
	section: unknown | null;
	account_url: unknown | null;
	account_id: number;
	is_ad: boolean;
	in_most_viral: boolean;
	has_sound: boolean;
	tags: string[];
	ad_type: number;
	ad_url: string;
	edited?: number;
	in_gallery: boolean;
	deletehash: string;
	name: string;
	link: string;
}

export interface UploadResponse {
	data: ImageData;
	success: boolean;
	status: number;
}

interface Cache {
	get(key: string): Promise<unknown | undefined>;
	set(key: string, value: unknown): Promise<unknown>;
}

interface RateLimitData {
	userlimit: null | number;
	userremaining: null | number;
	userreset: null | number;
	clientlimit: null | number;
	clientremaining: null | number;
	clientreset: null | number;
}

interface PostRateLimitData {
	limit: null | number;
	remaining: null | number;
	reset: null | number;
}

interface ImgurClientOptions {
	cache?: Cache;
	timeout?: number;
	retries?: number;
	rateLimitOffset?: number;
	rateLimitedWaitTime?: number;
}

export class ImgurClient {
	#authorisation!: string;
	baseURL = 'https://api.imgur.com/3/';
	queue = new AsyncQueue();
	cache?: Cache;
	timeout: number;
	rateLimitOffset: number;
	rateLimitedWaitTime: number;
	retries: number;
	rateLimit: RateLimitData = {
		userlimit: null,
		userremaining: null,
		userreset: null,
		clientlimit: null,
		clientremaining: null,
		clientreset: null,
	};
	postRateLimit: PostRateLimitData = {
		limit: null,
		remaining: null,
		reset: null,
	};

	/**
	 * @param clientId
	 * @param options
	 */
	constructor(
		clientId: string,
		{ cache, timeout, retries, rateLimitOffset, rateLimitedWaitTime }: ImgurClientOptions = {},
	) {
		this.authorisation = clientId;
		this.cache = cache;
		this.timeout = timeout ?? seconds(10);
		this.retries = retries ?? 1;
		this.rateLimitOffset = rateLimitOffset ?? seconds(1);
		this.rateLimitedWaitTime = rateLimitedWaitTime ?? seconds(10);

		// restore cached rateLimit data
		void (async () => {
			try {
				const data = (await cache?.get('ratelimits')) as { rateLimit: RateLimitData; postRateLimit: PostRateLimitData };

				// no cached data or rateLimit data is already present
				if (!data || this.rateLimit.userlimit !== null) return;

				this.rateLimit = data.rateLimit;
				this.postRateLimit = data.postRateLimit;
			} catch (error) {
				logger.error(error);
			}
		})();
	}

	get authorisation() {
		return this.#authorisation;
	}

	set authorisation(clientId) {
		this.#authorisation = `Client-ID ${clientId}`;
	}

	/**
	 * caches the current ratelimit data
	 */
	cacheRateLimits() {
		if (!this.cache || this.rateLimit.userlimit === null) return Promise.resolve();

		return this.cache.set('ratelimits', {
			rateLimit: this.rateLimit,
			postRateLimit: this.postRateLimit,
		});
	}

	/**
	 * uploads an image
	 * @param url
	 * @param type
	 */
	upload(url: string, type = 'url') {
		const form = new FormData();

		form.append('image', url);
		form.append('type', type);

		return this.request(
			'image',
			{
				method: 'POST',
				body: form,
			},
			{
				checkRateLimit: true,
				cacheKey: url,
			},
		) as Promise<UploadResponse>;
	}

	/**
	 * @param endpoint
	 * @param requestOptions
	 * @param options
	 */
	async request(
		endpoint: string,
		requestOptions: RequestInit,
		{ checkRateLimit = true, cacheKey }: { checkRateLimit?: boolean; cacheKey: string },
	) {
		const cached = await this.cache?.get(cacheKey);
		if (cached) return cached;

		await this.queue.wait({ signal: requestOptions.signal });

		try {
			// check rate limit
			if (checkRateLimit) {
				if (this.rateLimit.userremaining === 0) {
					const RESET_TIME = this.rateLimit.userreset! - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) {
						throw new Error(`imgur user rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					}
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}

				if (this.rateLimit.clientremaining === 0) {
					if (this.rateLimit.clientreset === null) throw new Error('imgur client rate limit, unknown clientreset');

					const RESET_TIME = this.rateLimit.clientreset - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) {
						throw new Error(`imgur client rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					}
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}

				if ((requestOptions.method === 'POST' || !requestOptions.method) && this.postRateLimit.remaining === 0) {
					const RESET_TIME = this.postRateLimit.reset! - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) {
						throw new Error(`imgur post rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					}
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}
			}

			const res = await this._request(endpoint, requestOptions);

			// get server time
			const date = res.headers.get('date');
			const NOW = date ? Date.parse(date) || Date.now() : Date.now();

			// get ratelimit headers
			for (const type of keys(this.rateLimit)) {
				const data = Number.parseInt(res.headers.get(`x-ratelimit-${type}`)!, 10);
				if (Number.isNaN(data)) continue;

				this.rateLimit[type] = type.endsWith('reset')
					? (data < 1e9 ? NOW : 0) + seconds(data) + this.rateLimitOffset // x-ratelimit-reset is seconds until reset -> convert to timestamp
					: data;
			}

			for (const type of keys(this.postRateLimit)) {
				const data = Number.parseInt(res.headers.get(`x-post-rate-limit-${type}`)!, 10);
				if (Number.isNaN(data)) continue;

				this.postRateLimit[type] = type.endsWith('reset')
					? (data < 1e9 ? NOW : 0) + seconds(data) + this.rateLimitOffset // x-ratelimit-reset is seconds until reset -> convert to timestamp
					: data;
			}

			// check response
			if (res.status !== 200) {
				void consumeBody(res);
				throw new FetchError('ImgurAPIError', res);
			}

			const parsedRes = await res.json();
			await this.cache?.set(cacheKey, parsedRes); // cache

			return parsedRes;
		} finally {
			this.queue.shift();
		}
	}

	/**
	 * make request
	 * @param endpoint
	 * @param options
	 * @param retries current retry
	 */
	private async _request(endpoint: string, { headers, ...options }: RequestInit, retries = 0): Promise<Response> {
		try {
			return await fetch(`${this.baseURL}${endpoint}`, {
				headers: {
					Authorization: this.#authorisation,
					...headers,
				},
				// @ts-expect-error
				signal: AbortSignal.timeout(this.timeout),
				...options,
			});
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if ((error as ErrorWithCode)?.code === ErrorCode.AbortErr && retries !== this.retries) {
				return this._request(endpoint, { headers, ...options }, retries + 1);
			}

			throw error;
		}
	}
}
