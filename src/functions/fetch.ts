import { logger } from './logger';
import type { Response } from 'undici';

/**
 * consumes the response body to help with gc
 * @param res
 */
export async function consumeBody(res: Response) {
	logger.warn(res, '[CONSUME BODY]: triggered');

	if (res.body === null) return;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	for await (const _chunk of res.body) {
		// force consumption of body
	}
}
