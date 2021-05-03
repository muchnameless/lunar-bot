'use strict';

module.exports = class ChatBridgeError extends Error {
	/**
	 * @param {string} message
	 * @param {string} status
	 */
	constructor(message, status) {
		super(message);

		this.name = 'ChatBridgeError';
		this.status = status;
	}
};
