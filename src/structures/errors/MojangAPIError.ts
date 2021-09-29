import type { Response } from 'node-fetch';


export class MojangAPIError extends Error {
	status: number | string;
	statusText?: string;

	/**
	 * @param param0
	 * @param queryType
	 * @param input
	 */
	constructor({ status, statusText }: Response | { status: number | string, statusText?: string }, queryType?: string | null, input?: string) {
		let message;

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

		if (statusText && statusText !== 'No Content') message += ` (${statusText})`;

		super(message);

		this.name = 'MojangAPIError';
		this.status = status;
		this.statusText = statusText;
	}

	override toString() {
		return `${this.name}${this.status ? ` ${this.status}` : ''}: ${this.message}`;
	}
}
