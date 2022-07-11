import { FetchError } from './FetchError';
import type { Response } from 'undici';

export class MojangAPIError extends FetchError {
	/**
	 * @param response
	 * @param queryType
	 * @param input
	 */
	constructor(response: Partial<Response>, queryType?: string | null, input?: string) {
		let message: string;

		switch (queryType) {
			case 'ign':
				message = `invalid IGN \`${input}\``;
				break;

			case 'uuid':
				message = `invalid uuid \`${input}\``;
				break;

			case 'ignOrUuid':
				message = `invalid IGN or uuid \`${input}\``;
				break;

			default:
				message = `unknown query \`${input}\``;
				break;
		}

		super('MojangAPIError', response, message);
	}
}
