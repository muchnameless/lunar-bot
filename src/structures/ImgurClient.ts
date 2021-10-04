import { AsyncQueue } from '@sapphire/async-queue';
import { setTimeout as sleep } from 'node:timers/promises';
import { FormData } from 'undici';
import fetch from 'node-fetch';
import ms from 'ms';
import { FetchError } from './errors/FetchError';
import type { BodyInit, RequestInit, Response } from 'node-fetch';


export interface ImageData {
	/* eslint-disable camelcase */
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
	/* eslint-enable camelcase */
}

export interface UploadResponse {
	data: ImageData;
	success: boolean;
	status: number;
}

interface Cache {
	get(key: string): Promise<unknown | undefined>;
	set(key: string, value: unknown): Promise<true>;
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
	#baseURL = 'https://api.imgur.com/3/';
	#queue = new AsyncQueue();
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
	constructor(clientId: string, { cache, timeout, retries, rateLimitOffset, rateLimitedWaitTime }: ImgurClientOptions = {}) {
		this.authorisation = clientId;
		this.cache = cache;
		this.timeout = timeout ?? 10_000;
		this.retries = retries ?? 1;
		this.rateLimitOffset = rateLimitOffset ?? 1_000;
		this.rateLimitedWaitTime = rateLimitedWaitTime ?? 60_000;
	}

	/**
	 * request queue
	 */
	get queue() {
		return this.#queue;
	}

	get authorisation() {
		return this.#authorisation;
	}

	set authorisation(clientId) {
		this.#authorisation = `Client-ID ${clientId}`;
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
			'upload',
			{
				method: 'POST',
				body: form as unknown as BodyInit,
				headers: {
					Accept: 'application/json',
				},
			}, {
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
	async request(endpoint: string, requestOptions: RequestInit, { checkRateLimit = true, cacheKey }: { checkRateLimit?: boolean; cacheKey: string; }) {
		const cached = await this.cache?.get(cacheKey);
		if (cached) return cached;

		await this.#queue.wait();

		try {
			// check rate limit
			if (checkRateLimit) {
				if (this.rateLimit.userremaining === 0) {
					const RESET_TIME = this.rateLimit.userreset! - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) throw new Error(`imgur user rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}

				if (this.rateLimit.clientremaining === 0) {
					if (this.rateLimit.clientreset === null) throw new Error('imgur client rate limit, unknown clientreset');

					const RESET_TIME = this.rateLimit.clientreset - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) throw new Error(`imgur client rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}

				if ((requestOptions.method === 'POST' || !requestOptions.method) && this.postRateLimit.remaining === 0) {
					const RESET_TIME = this.postRateLimit.reset! - Date.now();

					if (RESET_TIME > this.rateLimitedWaitTime) throw new Error(`imgur post rate limit, resets in ${ms(RESET_TIME, { long: true })}`);
					if (RESET_TIME > 0) await sleep(RESET_TIME);
				}
			}

			const res = await this.#request(endpoint, requestOptions);

			// get server time
			const date = res.headers.get('date');
			const NOW = date
				? Date.parse(date) || Date.now()
				: Date.now();

			// get ratelimit headers
			for (const type of Object.keys(this.rateLimit)) {
				const data = res.headers.get(`x-ratelimit-${type}`);

				if (data !== null) {
					this.rateLimit[type as keyof RateLimitData] = type.endsWith('reset')
						? NOW + (Number.parseInt(data, 10) * 1_000) + this.rateLimitOffset // x-ratelimit-reset is seconds until reset -> convert to timestamp
						: Number.parseInt(data, 10);
				}
			}

			for (const type of Object.keys(this.postRateLimit)) {
				const data = res.headers.get(`x-post-rate-limit-${type}`);

				if (data !== null) {
					this.postRateLimit[type as keyof PostRateLimitData] = type.endsWith('reset')
						? NOW + (Number.parseInt(data, 10) * 1_000) + this.rateLimitOffset // x-post-rate-limit-reset is seconds until reset -> convert to timestamp
						: Number.parseInt(data, 10);
				}
			}

			// check response
			if (res.status !== 200) {
				throw new FetchError('ImgurAPIError', res);
			}

			const parsedRes = await res.json();
			await this.cache?.set(cacheKey, parsedRes); // cache

			return parsedRes;
		} finally {
			this.#queue.shift();
		}
	}

	/**
	 * make request
	 * @param endpoint
	 * @param options
	 * @param retries current retry
	 */
	async #request(endpoint: string, { headers, ...options }: RequestInit, retries = 0): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(
				`${this.#baseURL}${endpoint}`,
				{
					headers: {
						Authorization: this.#authorisation,
						...headers,
					},
					signal: controller.signal,
					...options,
				},
			);
		} catch (error) {
			// Retry the specified number of times for possible timed out requests
			if (error instanceof Error && error.name === 'AbortError' && retries !== this.retries) {
				return this.#request(endpoint, { headers, ...options }, retries + 1);
			}

			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}
