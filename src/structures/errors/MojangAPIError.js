'use strict';

class MojangAPIError extends Error {
	/**
	 * @param {object} param1
	 * @param {number} [param1.status]
	 * @param {string} [param1.statusText]
	 * @param {string} resultField
	 */
	constructor({ status, statusText }, resultField) {
		super();

		this.name = 'MojangAPIError';
		this.code = status;
		this.message = statusText;

		switch (resultField) {
			case 'id':
				this.message = 'invalid IGN';
				break;

			case 'name':
				this.message = 'invalid uuid';
				break;

			default:
				this.message = statusText;
				break;
		}
	}
}

module.exports = MojangAPIError;
