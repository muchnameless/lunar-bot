import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { CommandInteraction } from 'discord.js';


export default class MyCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder(),
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
