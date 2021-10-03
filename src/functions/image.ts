import { BUST_IMAGE_URL } from '../constants';
import { cache } from '../api/cache';
import { imgur } from '../api/imgur';
import { logger } from '.';
import type { LunarClient } from '../structures/LunarClient';


/**
 * takes a minecraft uuid and returns the imgur link to an uploaded bust image
 * @param client
 * @param uuid minecraft UUID
 */
export async function uuidToImgurBustURL({ config }: LunarClient, uuid: string) {
	if (!config.get('IMGUR_UPLOADER_ENABLED')) return null;

	try {
		const cacheKey = `image:bust:${uuid}`;
		const cachedResult = await cache.get(cacheKey) as string | undefined;

		if (cachedResult) return cachedResult;

		const URL = (await imgur.upload(`${BUST_IMAGE_URL}${uuid}`)).data.link;

		cache.set(cacheKey, URL, 24 * 60 * 60 * 1_000);

		return URL;
	} catch (error) {
		return logger.error(error);
	}
}
