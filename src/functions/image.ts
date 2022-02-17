import { BUST_IMAGE_URL } from '../constants';
import { redis, imgur } from '../api';
import { days, logger } from '.';
import type { LunarClient } from '../structures/LunarClient';

export const uuidToBustURL = (uuid: string) => `${BUST_IMAGE_URL}${uuid}` as const;

/**
 * takes a minecraft uuid and returns the imgur link to an uploaded bust image
 * @param client
 * @param uuid minecraft UUID
 */
export async function uuidToImgurBustURL({ config }: LunarClient, uuid: string) {
	try {
		const cacheKey = `image:bust:${uuid}`;
		const cachedResult = await redis.get(cacheKey);

		if (cachedResult) return cachedResult;

		if (!config.get('IMGUR_UPLOADER_ENABLED')) return null;

		const URL = (await imgur.upload(uuidToBustURL(uuid))).data.link;

		redis.psetex(cacheKey, days(3), URL);

		return URL;
	} catch (error) {
		logger.error(error);
		return null;
	}
}
