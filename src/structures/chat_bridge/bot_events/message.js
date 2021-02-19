'use strict';

const HypixelMessage = require('../HypixelMessage');
const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 * @param {HypixelMessage.TextComponent[]} jsonMessage chat message from the server
 * @param {HypixelMessage.ChatPosition} position
 */
module.exports = async (chatBridge, jsonMessage, position) => {
	chatBridge.emit('message', new HypixelMessage(chatBridge, jsonMessage, position));
};
