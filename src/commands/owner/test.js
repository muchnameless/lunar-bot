import { Constants } from 'discord.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
// import { logger } from '../../functions/logger.js';


export default class TestCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'generic test command',
			options: [{
				name: 'input',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'input',
				required: false,
			}],
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
