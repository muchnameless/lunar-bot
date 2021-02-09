'use strict';

const ConfigCollection = require('../../structures/collections/ConfigCollection');
const LunarMessage = require('../../structures/extensions/Message');
const LunarClient = require('../../structures/LunarClient');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class PingCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'p' ],
			description: 'check API latency and WebSocket ping',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {LunarClient} client
	 * @param {ConfigCollection} config
	 * @param {LunarMessage} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const pingMessage = await message.reply('awaiting ping...', { reply: false });

		if (!pingMessage) return;

		pingMessage.edit(`Api Latency: ${pingMessage.createdTimestamp - message.createdTimestamp} ms | Average WebSocket Heartbeat: ${Math.round(client.ws.ping)} ms.`);
	}
};
