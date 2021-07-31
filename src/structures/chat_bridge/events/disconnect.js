'use strict';

const ChatBridgeEvent = require('../ChatBridgeEvent');
const logger = require('../../../functions/logger');


module.exports = class DisconnectChatBridgeEvent extends ChatBridgeEvent {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {?string} reason
	 */
	async run(reason) {
		this.chatBridge.minecraft.ready = false;

		logger.error(`[CHATBRIDGE END]: Minecraft bot disconnected from server: ${reason ?? 'unknown'}`);

		this.chatBridge.minecraft.reconnect();
	}
};
