'use strict';

class MojangAPIError extends Error {
	/**
	 * @param {object} param1
	 * @param {number} [param1.status]
	 * @param {string} [param1.statusText]
	 * @param {string} resultField
	 */
	constructor({ status, statusText }, resultField, input) {
		super();

		this.name = 'MojangAPIError';
		this.code = status;
		this.message = statusText;

		switch (resultField) {
			case 'id':
				this.message = `invalid IGN '${input}'`;
				break;

			case 'name':
				this.message = `invalid uuid '${input}'`;
				break;

			default:
				this.message = `${statusText} '${input}'`;
				break;
		}
	}

	toString() {
		return `${this.name}${this.code ? ` ${this.code}` : ''}: ${this.message}`;
	}
}

module.exports = MojangAPIError;
