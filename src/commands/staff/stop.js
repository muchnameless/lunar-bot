import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionUtil } from '../../util/index.js';
import { logger } from '../../functions/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';


export default class StopCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('stop the bot. It should restart immediatly'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		try {
			await InteractionUtil.reply(interaction, 'stopping the bot');
		} catch (error) {
			logger.error(error);
		} finally {
			this.client.exit();
		}
	}
}
