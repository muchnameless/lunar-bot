import { BUST_IMAGE_URL } from '../constants';
import { cache } from '../api/cache';
import { imgur } from '../api/imgur';
import { logger } from '.';


/**
 * takes a minecraft uuid and returns the imgur link to an uploaded bust image
 * @param uuid minecraft UUID
 */
export async function uuidToImgurBustURL(uuid: string) {
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
