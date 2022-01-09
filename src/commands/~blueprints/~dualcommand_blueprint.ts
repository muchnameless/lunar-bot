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
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	override async runSlash(interaction: ChatInputCommandInteraction) {
		// do stuff
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	override async runMinecraft(hypixelMessage: HypixelUserMessage) {
		// do stuff
	}
}
