import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';

export default class TestCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
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
	 *
	 * @param interaction
	 */
	public override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		// do stuff
	}
}
