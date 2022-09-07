import { clearTimeout, setTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { AsyncQueue } from '@sapphire/async-queue';
import { RateLimitManager } from '@sapphire/ratelimits';
import { fetch, type Headers, type RequestInit, type Response } from 'undici';
import { FetchError } from './errors/FetchError.js';
import { consumeBody, days, hours, isAbortError, seconds } from '#functions';

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

interface ImgurClientOptions {
	cache?: Cache;
	rateLimitResetOffset?: number;
	retries?: number;
	timeout?: number;
}

export class ImgurClient {
	#authorisation!: string;

	private readonly baseURL = 'https://api.imgur.com/3/';

	/**
	 * https://api.imgur.com/
	 * https://apidocs.imgur.com/
	 */
	public readonly rateLimitManagers = [
		// user
		{
			manager: new RateLimitManager(hours(1), 500),
			get rateLimit() {
				return this.manager.acquire('global');
			},
			remainingKey: 'x-ratelimit-userremaining',
			resetKey: 'x-ratelimit-userreset',
			limitKey: 'x-ratelimit-userlimit',
		},
		// client
		{
			manager: new RateLimitManager(days(1), 12_500),
			get rateLimit() {
				return this.manager.acquire('global');
			},
			remainingKey: 'x-ratelimit-clientremaining',
			resetKey: 'x-ratelimit-clientreset',
			limitKey: 'x-ratelimit-clientlimit',
		},
		// post
		{
			manager: new RateLimitManager(hours(1), 1_250),
			get rateLimit() {
				return this.manager.acquire('global');
			},
			remainingKey: 'x-post-rate-limit-remaining',
			resetKey: 'x-post-rate-limit-reset',
			limitKey: 'x-post-rate-limit-limit',
		},
	] as const;

	public readonly queue = new AsyncQueue();

	private readonly cache?: Cache;

	private readonly rateLimitResetOffset: number;

	private readonly retries: number;

	private readonly timeout: number;

	/**
	 * @param clientId
	 * @param options
	 */
	public constructor(clientId: string, { cache, rateLimitResetOffset, retries, timeout }: ImgurClientOptions = {}) {
		this.authorisation = clientId;
		this.cache = cache;
		this.rateLimitResetOffset = rateLimitResetOffset ?? seconds(1);
		this.retries = retries ?? 3;
		this.timeout = timeout ?? seconds(20);
	}

	/**
	 * Authorization header
	 */
	public get authorisation() {
		return this.#authorisation;
	}

	public set authorisation(clientId) {
		this.#authorisation = `Client-ID ${clientId}`;
	}

	/**
	 * uploads an image
	 *
	 * @param imageURL - url to upload
	 * @param signal
	 */
	public async uploadURL(imageURL: string, signal?: AbortSignal) {
		const url = new URL('image', this.baseURL);

		url.searchParams.append('type', 'url');
		url.searchParams.append('image', imageURL);

		return this.request(
			url,
			{
				method: 'POST',
			},
			imageURL,
			signal,
		) as Promise<UploadResponse>;
	}

	/**
	 * @param url
	 * @param requestInit
	 * @param cacheKey
	 */
	public async request(url: URL, requestInit: RequestInit, cacheKey: string, signal?: AbortSignal) {
		const cached = await this.cache?.get(cacheKey);
		if (cached) return cached;

		const res = await this.#request(
			url,
			{
				...requestInit,
				headers: { Authorization: this.#authorisation, ...requestInit.headers },
			},
			signal,
		);

		this.getRateLimitHeaders(res.headers);

		// check response
		if (res.status !== 200) {
			void consumeBody(res);
			throw new FetchError('ImgurAPIError', res);
		}

		const parsedRes = await res.json();
		await this.cache?.set(cacheKey, parsedRes); // cache

		return parsedRes;
	}

	/**
	 * make request
	 *
	 * @param url
	 * @param requestInit
	 * @param signal
	 * @param retries - current retry
	 */
	async #request(url: URL, requestInit: RequestInit, signal?: AbortSignal, retries = 0): Promise<Response> {
		for (const { rateLimit } of this.rateLimitManagers) {
			if (rateLimit.limited) {
				await this.queue.wait({ signal });

				if (rateLimit.limited) {
					try {
						await sleep(rateLimit.remainingTime + this.rateLimitResetOffset, null, { signal });
					} catch (error) {
						this.queue.shift();
						throw error;
					}
				}

				rateLimit.consume();
				this.queue.shift();
			} else {
				rateLimit.consume();
			}
		}

		signal?.throwIfAborted();

		// internal AbortSignal (to have a timeout without having to abort the external signal)
		const controller = new AbortController();
		const listener = () => controller.abort();
		const timeout = setTimeout(listener, this.timeout);

		// external AbortSignal
		signal?.addEventListener('abort', listener);

		try {
			return await fetch(url, {
				signal: controller.signal,
				...requestInit,
			});
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if (isAbortError(error) && retries !== this.retries) {
				// eslint-disable-next-line @typescript-eslint/return-await
				return this.#request(url, requestInit, signal, retries + 1);
			}

			throw error;
		} finally {
			clearTimeout(timeout);

			signal?.removeEventListener('abort', listener);
		}
	}

	/**
	 * updates ratelimits from headers
	 *
	 * @param headers
	 */
	private getRateLimitHeaders(headers: Headers) {
		// get server time
		const serverTime = Date.parse(headers.get('date')!);
		const now = Date.now();

		for (const { manager, rateLimit, remainingKey, resetKey, limitKey } of this.rateLimitManagers) {
			const remaining = Number.parseInt(headers.get(remainingKey)!, 10);
			if (remaining < rateLimit.remaining) {
				rateLimit.remaining = remaining;
			}

			const reset =
				resetKey === 'x-post-rate-limit-reset'
					? // time left in seconds
					  seconds(Number.parseInt(headers.get(resetKey)!, 10)) + (serverTime || now)
					: // timestamp in seconds
					  seconds(Number.parseInt(headers.get(resetKey)!, 10));
			if (reset > now) {
				rateLimit.expires = reset;
			}

			const limit = Number.parseInt(headers.get(limitKey)!, 10);
			if (limit) {
				// @ts-expect-error readonly
				manager.limit = limit;
			}
		}
	}
}
