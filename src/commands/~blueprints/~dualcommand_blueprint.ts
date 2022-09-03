import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';

export default class MyCommand extends DualCommand {
	public constructor(context: CommandContext) {
		super(
			context,
			{
				aliases: [],
				slash: new SlashCommandBuilder(),
				cooldown: 0,
			},
			{
				aliases: [],
			},
		);
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		// do stuff
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override minecraftRun(hypixelMessage: HypixelUserMessage) {
		// do stuff
	}
}
