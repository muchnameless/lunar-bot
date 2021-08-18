export class MojangAPIError extends Error {
	/**
	 * @param {object} param1
	 * @param {number} [param1.status]
	 * @param {string} [param1.statusText]
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
		this.code = status;
		this.statusText = statusText;
	}

	toString() {
		return `${this.name}${this.code ? ` ${this.code}` : ''}: ${this.message}`;
	}
}
