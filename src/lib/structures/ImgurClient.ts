import { clearTimeout, setTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { AsyncQueue } from '@sapphire/async-queue';
import ms from 'ms';
import { fetch, type Response, type RequestInit } from 'undici';
import { FetchError } from './errors/FetchError.js';
import { consumeBody, isAbortError, seconds } from '#functions';
import { logger } from '#logger';
import { keys } from '#types';

export interface ImageData {
	account_id: number;
	account_url: unknown | null;
	ad_type: number;
	ad_url: string;
	animated: boolean;
	bandwidth: number;
	datetime: number;
	deletehash: string;
	description: string | null;
	edited?: number;
	favorite: boolean;
	has_sound: boolean;
	height: number;
	id: string;
	in_gallery: boolean;
	in_most_viral: boolean;
	is_ad: boolean;
	link: string;
	name: string;
	nsfw: boolean | null;
	section: unknown | null;
	size: number;
	tags: string[];
	title: string | null;
	type: string;
	views: number;
	vote: unknown | null;
	width: number;
}

export interface UploadResponse {
	data: ImageData;
	status: number;
	success: boolean;
}

interface Cache {
	get(key: string): Promise<unknown | undefined>;
	set(key: string, value: unknown): Promise<unknown>;
}

interface RateLimitData {
	clientlimit: number | null;
	clientremaining: number | null;
	clientreset: number | null;
	userlimit: number | null;
	userremaining: number | null;
	userreset: number | null;
}

interface PostRateLimitData {
	limit: number | null;
	remaining: number | null;
	reset: number | null;
}

interface ImgurClientOptions {
	cache?: Cache;
	rateLimitOffset?: number;
	rateLimitedWaitTime?: number;
	retries?: number;
	timeout?: number;
}

export class ImgurClient {
	#authorisation!: string;

	private readonly baseURL = 'https://api.imgur.com/3/';

	public readonly queue = new AsyncQueue();

	private readonly cache?: Cache;

	private readonly timeout: number;

	private readonly rateLimitOffset: number;

	private readonly rateLimitedWaitTime: number;

	private readonly retries: number;

	public rateLimit: RateLimitData = {
		userlimit: null,
		userremaining: null,
		userreset: null,
		clientlimit: null,
		clientremaining: null,
		clientreset: null,
	};

	public postRateLimit: PostRateLimitData = {
		limit: null,
		remaining: null,
		reset: null,
	};

	/**
	 * @param clientId
	 * @param options
	 */
	public constructor(
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
				const data = (await cache?.get('ratelimits')) as
					| { postRateLimit: PostRateLimitData; rateLimit: RateLimitData }
					| undefined;

				// no cached data or rateLimit data is already present
				if (!data || this.rateLimit.userlimit !== null) return;

				this.rateLimit = data.rateLimit;
				this.postRateLimit = data.postRateLimit;
			} catch (error) {
				logger.error(error);
			}
		})();
	}

	public get authorisation() {
		return this.#authorisation;
	}

	public set authorisation(clientId) {
		this.#authorisation = `Client-ID ${clientId}`;
	}

	/**
	 * caches the current ratelimit data
	 */
	public async cacheRateLimits() {
		if (!this.cache || this.rateLimit.userlimit === null) return null;

		return this.cache.set('ratelimits', {
			rateLimit: this.rateLimit,
			postRateLimit: this.postRateLimit,
		});
	}

	/**
	 * uploads an image
	 *
	 * @param imageURL
	 * @param type
	 */
	public async upload(
		imageURL: string,
		{ type = 'url', signal }: { signal?: AbortSignal; type?: 'file' | 'url' } = {},
	) {
		const url = new URL('image', this.baseURL);

		url.searchParams.append('type', type);
		url.searchParams.append('image', imageURL);

		return this.request(
			url,
			{
				method: 'POST',
				signal,
			},
			{
				checkRateLimit: true,
				cacheKey: imageURL,
			},
		) as Promise<UploadResponse>;
	}

	/**
	 * @param url
	 * @param requestInit
	 * @param options
	 */
	public async request(
		url: URL,
		requestInit: RequestInit,
		{ checkRateLimit = true, cacheKey }: { cacheKey: string; checkRateLimit?: boolean },
	) {
		const cached = await this.cache?.get(cacheKey);
		if (cached) return cached;

		await this.queue.wait({ signal: requestInit.signal });

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

				if ((requestInit.method === 'POST' || !requestInit.method) && this.postRateLimit.remaining === 0) {
					const RESET_TIME = this.postRateLimit.reset! - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) {
						throw new Error(`imgur post rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					}

					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}
			}

			const res = await this._request(url, requestInit);

			// get server time
			const NOW = Date.parse(res.headers.get('date')!) || Date.now();

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
	 *
	 * @param url
	 * @param requestInit
	 * @param retries current retry
	 */
	private async _request(url: URL, { headers, signal, ...options }: RequestInit, retries = 0): Promise<Response> {
		signal?.throwIfAborted();

		// internal AbortSignal (to have a timeout without having to abort the external signal)
		const controller = new AbortController();
		const listener = () => controller.abort();
		const timeout = setTimeout(listener, this.timeout);

		// external AbortSignal
		signal?.addEventListener('abort', listener);

		try {
			return await fetch(url, {
				headers: {
					Authorization: this.#authorisation,
					...headers,
				},
				signal: controller.signal,
				...options,
			});
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if (isAbortError(error) && retries !== this.retries) {
				// eslint-disable-next-line @typescript-eslint/return-await
				return this._request(url, { headers, signal, ...options }, retries + 1);
			}

			throw error;
		} finally {
			clearTimeout(timeout);

			signal?.removeEventListener('abort', listener);
		}
	}
}
