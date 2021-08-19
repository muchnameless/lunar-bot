import fetch from 'node-fetch';
import { cache } from '../api/cache.js';
import { logger } from './index.js';


export async function uuidToImageBuffer(uuid) {
	try {
		const cacheKey = `image:bust:${uuid}`;
		const cachedResult = await cache.get(cacheKey);

		if (cachedResult) return cachedResult;

		const result = await fetch(`https://visage.surgeplay.com/bust/${uuid}`);

		if (result.status !== 200) return null;

		const buffer = await result.buffer();

		cache.set(cacheKey, buffer);

		return buffer;
	} catch (error) {
		return logger.error(error);
	}
}
