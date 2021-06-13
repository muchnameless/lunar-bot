'use strict';

const handleDiscordMessage = require('../functions/handleDiscordMessage');
// const logger = require('../functions/logger');


/**
 * messageUpdate
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Message')} oldMessage
 * @param {import('../structures/extensions/Message')} newMessage
 */
module.exports = async (client, oldMessage, newMessage) => {
	if (oldMessage.content === newMessage.content) return; // pin or added embed

	if (newMessage.me) client.chatBridges.handleDiscordMessage(newMessage, { checkifNotFromBot: false });

	handleDiscordMessage(newMessage);
};
