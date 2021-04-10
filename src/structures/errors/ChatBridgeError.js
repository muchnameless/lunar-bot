'use strict';

class ChatBridgeError extends Error {
	constructor(message, status) {
		super(message);

		this.name = 'ChatBridgeError';
		this.status = status;
	}
}

module.exports = ChatBridgeError;
