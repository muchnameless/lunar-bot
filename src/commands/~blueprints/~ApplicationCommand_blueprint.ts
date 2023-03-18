import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';

export default class MyCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder(),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		// do stuff
	}
}
