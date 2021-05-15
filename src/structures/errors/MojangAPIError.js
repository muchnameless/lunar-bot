'use strict';

module.exports = class MojangAPIError extends Error {
	/**
	 * @param {object} param1
	 * @param {number} [param1.status]
	 * @param {string} [param1.statusText]
	 * @param {string} queryType
	 */
	constructor({ status, statusText }, queryType, input) {
		super();

		this.name = 'MojangAPIError';
		this.code = status;

		switch (queryType) {
			case 'ign':
				this.message = `invalid IGN \`${input}\``;
				break;

			case 'uuid':
				this.message = `invalid uuid \`${input}\``;
				break;

			case 'ignOrUuid':
				this.message = `invalid IGN or uuid \`${input}\``;
				break;

			default:
				this.message = `${statusText} \`${input}\``;
				break;
		}
	}

	toString() {
		return `${this.name}${this.code ? ` ${this.code}` : ''}: ${this.message}`;
	}
};
