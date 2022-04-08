import { SlashCommandBuilder } from '@discordjs/builders';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';

export default class MyCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				aliases: [],
				slash: new SlashCommandBuilder(),
				cooldown: 0,
			},
			{
				aliases: [],
				args: false,
				usage: '',
			},
		);
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		interaction;
		// do stuff
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override minecraftRun(hypixelMessage: HypixelUserMessage) {
		hypixelMessage;
		// do stuff
	}
}
