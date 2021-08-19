import { SlashCommandBuilder } from '@discordjs/builders';
// import { InteractionUtil } from '../../util/InteractionUtil.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
// import { logger } from '../../functions/logger.js';


export default class TestCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('generic test command')
				.addStringOption(option => option
					.setName('input')
					.setDescription('input')
					.setRequired(false),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) { // eslint-disable-line no-unused-vars
		// do stuff
	}
}
