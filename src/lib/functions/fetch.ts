import type { Dispatcher } from 'undici';

/**
 * consumes the response body to help with gc
 * @param res
 */
export async function consumeBody(res: Dispatcher.ResponseData) {
	if (res.body.bodyUsed) return;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	for await (const _chunk of res.body) {
		// force consumption of body
	}
}
