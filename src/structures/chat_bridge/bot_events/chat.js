'use strict';

const HypixelMessage = require('../HypixelMessage');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {object} packet
 * @param {number} packet.position
 * @param {HypixelMessage.ChatPosition} position
 */
module.exports = async (chatBridge, { position, message }) => {
	try {
		chatBridge.emit('message', await new HypixelMessage(chatBridge, position, JSON.parse(message)).init());
	} catch (error) {
		logger.error('[MINECRAFT BOT CHAT]', error);

		chatBridge.emit('message', await new HypixelMessage(chatBridge, position, message).init());
	}
};
