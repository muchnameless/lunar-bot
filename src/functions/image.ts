import { BUST_IMAGE_URL } from '../constants';
import { cache, imgur } from '../api';
import { days, logger } from '.';
import type { LunarClient } from '../structures/LunarClient';


/**
 * takes a minecraft uuid and returns the imgur link to an uploaded bust image
 * @param client
 * @param uuid minecraft UUID
 */
export async function uuidToImgurBustURL({ config }: LunarClient, uuid: string) {
	try {
		const cacheKey = `image:bust:${uuid}`;
		const cachedResult = await cache.get(cacheKey) as string | undefined;

		if (cachedResult) return cachedResult;

		if (!config.get('IMGUR_UPLOADER_ENABLED')) return null;

		const URL = (await imgur.upload(`${BUST_IMAGE_URL}${uuid}`)).data.link;

		cache.set(cacheKey, URL, days(3));

		return URL;
	} catch (error) {
		logger.error(error);
		return null;
	}
}
