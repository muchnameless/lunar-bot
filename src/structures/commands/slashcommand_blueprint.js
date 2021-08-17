import { SlashCommand } from '../../structures/commands/SlashCommand.js';
// import { logger } from '../../functions/logger.js';


export default class MyCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: '',
			options: [],
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		// do stuff
	}
}
