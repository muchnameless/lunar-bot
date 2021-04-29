'use strict';

module.exports = class NonAPIError extends Error {
	constructor(message) {
		super(message);

		this.name = 'NonAPIError';
	}
};
