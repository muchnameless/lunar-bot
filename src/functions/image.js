import { BUST_IMAGE_URL } from '../constants/index.js';
import { cache } from '../api/cache.js';
import { logger } from './index.js';


/**
 * takes a minecraft uuid and returns the imgur link to an uploaded bust image
 * @param {import('../structures/LunarClient').LunarClient} client
 * @param {string} uuid
 * @returns {Promise<string>}
 */
export async function uuidToImgurBustURL(client, uuid) {
	try {
		const cacheKey = `image:bust:${uuid}`;
		const cachedResult = await cache.get(cacheKey);

		if (cachedResult) return cachedResult;

		const URL = (await client.imgur.upload(`${BUST_IMAGE_URL}${uuid}`)).data.link;

		cache.set(cacheKey, URL, 24 * 60 * 60 * 1_000);

		return URL;
	} catch (error) {
		return logger.error(error);
	}
}
