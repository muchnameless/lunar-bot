'use strict';

const commandHandler = require('../functions/commandHandler');
const LunarMessage = require('../structures/extensions/Message');
const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * messageUpdate
 * @param {LunarClient} client
 * @param {LunarMessage} oldMessage
 * @param {LunarMessage} newMessage
 */
module.exports = async (client, oldMessage, newMessage) => {
	if (oldMessage.content === newMessage.content) return; // pin or added embed

	commandHandler(client, newMessage);
};
