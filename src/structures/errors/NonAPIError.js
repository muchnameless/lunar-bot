'use strict';

class NonAPIError extends Error {
	constructor(message) {
		super(message);

		this.name = 'NonAPIError';
	}
}

module.exports = NonAPIError;
