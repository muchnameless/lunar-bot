'use strict';

const commandHandler = require('../functions/commandHandler');


module.exports = async (client, oldMessage, newMessage) => {
	if (oldMessage.content === newMessage.content) return; // pin or added embed

	commandHandler(client, newMessage);
};
