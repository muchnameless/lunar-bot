'use strict';

module.exports = {
	aliases: [ 'p' ],
	description: 'check API latency and WebSocket ping',
	cooldown: 1,
	execute: async (message, args, flags) => {
		const pingMessage = await message.reply('awaiting ping...', { reply: false });

		if (!pingMessage) return;

		pingMessage.edit(`Api Latency: ${pingMessage.createdTimestamp - message.createdTimestamp} ms | Average WebSocket Heartbeat: ${Math.round(message.client.ws.ping)} ms.`);
	},
};
