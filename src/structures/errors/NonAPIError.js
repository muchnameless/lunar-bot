'use strict';

module.exports = class NonAPIError extends Error {
	/**
	 * @param {string} message
	 */
	constructor(message) {
		super(message);

		this.name = 'NonAPIError';
	}
};
