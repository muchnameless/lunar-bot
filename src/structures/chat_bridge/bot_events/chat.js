'use strict';

const HypixelMessage = require('../HypixelMessage');
// const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {object} packet
 * @param {number} packet.position
 * @param {HypixelMessage.ChatPosition} position
 */
module.exports = async (chatBridge, { position, message }) => {
	let hypixelMessage;

	try {
		hypixelMessage = new HypixelMessage(chatBridge, position, JSON.parse(message));
	} catch {
		hypixelMessage = new HypixelMessage(chatBridge, position, message);
	}

	chatBridge.emit('message', hypixelMessage);
};
