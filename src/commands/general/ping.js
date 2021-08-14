import ms from 'ms';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
// import { logger } from '../../functions/logger.js';


export default class PingCommand extends SlashCommand {
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		return await this.reply(interaction, `Api Latency: ${ms(Date.now() - interaction.createdTimestamp, { long: true })} | Average WebSocket Heartbeat: ${ms(Math.round(this.client.ws.ping), { long: true })}`);
	}
}
