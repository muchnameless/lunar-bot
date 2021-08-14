import { SlashCommand } from '../../structures/commands/SlashCommand.js';
import { logger } from '../../functions/logger.js';


export default class StopCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'stop the bot. It should restart immediatly',
			options: [],
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		try {
			await this.reply(interaction, 'stopping the bot');
		} catch (error) {
			logger.error(error);
		} finally {
			this.client.exit();
		}
	}
}
