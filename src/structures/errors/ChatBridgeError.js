'use strict';

class ChatBridgeError extends Error {
	constructor(message) {
		super(message);

		this.name = 'ChatBridgeError';
	}
}

module.exports = ChatBridgeError;
