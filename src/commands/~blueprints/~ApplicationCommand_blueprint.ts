import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { ChatInputCommandInteraction } from 'discord.js';

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
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	override async runSlash(interaction: ChatInputCommandInteraction) {
		// do stuff
	}
}
