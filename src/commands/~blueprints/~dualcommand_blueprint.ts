import { SlashCommandBuilder } from '@discordjs/builders';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { CommandInteraction } from 'discord.js';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';


export default class MyCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder(),
			cooldown: 0,
		}, {
			aliases: [],
			args: false,
			usage: '',
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) { // eslint-disable-line @typescript-eslint/no-unused-vars
		// do stuff
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelMessage<true>) { // eslint-disable-line @typescript-eslint/no-unused-vars
		// do stuff
	}
}
