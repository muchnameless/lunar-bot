'use strict';

const ms = require('ms');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class PingCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'check API latency and WebSocket ping',
			options: [],
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		return await interaction.reply(`Api Latency: ${ms(Date.now() - interaction.createdTimestamp, { long: true })} | Average WebSocket Heartbeat: ${ms(Math.round(this.client.ws.ping), { long: true })}`);
	}
};
