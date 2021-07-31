'use strict';

const BaseEvent = require('../events/BaseEvent');

module.exports = class ChatBridgeEvent extends BaseEvent {
	/**
	 * chatBridge
	 * @returns {import('./ChatBridge')}
	 */
	get chatBridge() {
		return this.emitter;
	}

	/**
	 * client
	 * @returns {import('../LunarClient')}
	 */
	get client() {
		return this.chatBridge.client;
	}
};
