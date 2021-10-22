import { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';


export default class TestCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
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
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) { // eslint-disable-line @typescript-eslint/no-unused-vars
		// do stuff
	}
}
