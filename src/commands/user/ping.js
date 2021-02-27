'use strict';

const ms = require('ms');
const Command = require('../../structures/commands/Command');
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
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/managers/ConfigManager')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const pingMessage = await message.reply('awaiting ping...', { reply: false });

		if (!pingMessage) return;

		pingMessage.edit(`Api Latency: ${ms(pingMessage.createdTimestamp - message.createdTimestamp, { long: true })} | Average WebSocket Heartbeat: ${ms(Math.round(client.ws.ping), { long: true })}.`);
	}
};
