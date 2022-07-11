import { SlashCommandBuilder } from 'discord.js';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class TestCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder() //
				.setDescription('generic test command')
				.addStringOption((option) =>
					option //
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
	override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		interaction;
		// do stuff
	}
}
