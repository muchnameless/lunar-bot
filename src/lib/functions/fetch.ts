import type { Response } from 'undici';

/**
 * consumes the response body to help with gc
 * @param res
 */
export async function consumeBody(res: Response) {
	if (!res.body || res.bodyUsed) return;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	for await (const _ of res.body) {
		// force consumption of body
	}
}
