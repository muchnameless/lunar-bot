'use strict';

const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'p' ],
			description: 'check API latency and WebSocket ping',
			cooldown: 1,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		const pingMessage = await message.reply('awaiting ping...', { reply: false });

		if (!pingMessage) return;

		pingMessage.edit(`Api Latency: ${pingMessage.createdTimestamp - message.createdTimestamp} ms | Average WebSocket Heartbeat: ${Math.round(client.ws.ping)} ms.`);
	}
};
