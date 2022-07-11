import { SlashCommandBuilder } from 'discord.js';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import type { CommandContext } from '#structures/commands/BaseCommand';
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
	override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		interaction;
		// do stuff
	}
}
