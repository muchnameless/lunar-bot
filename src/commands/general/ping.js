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
		const sent = await this.reply(interaction, {
			content: 'Pinging...',
			fetchReply: true,
		});

		return await this.reply(interaction, `Roundtrip latency: ${ms(sent.createdTimestamp - interaction.createdTimestamp, { long: true })} | Average WebSocket Heartbeat: ${ms(Math.round(this.client.ws.ping), { long: true })}`);
	}
}
