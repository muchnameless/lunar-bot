export class MojangAPIError extends Error {
	/**
	 * @param {import('undici').Response} param0
	 * @param {string} queryType
	 */
	constructor({ status, statusText }, queryType, input) {
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

	toString() {
		return `${this.name}${this.status ? ` ${this.status}` : ''}: ${this.message}`;
	}
}
