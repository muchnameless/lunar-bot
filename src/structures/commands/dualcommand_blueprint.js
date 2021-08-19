import { SlashCommandBuilder } from '@discordjs/builders';
// import { InteractionUtil } from '../../util/InteractionUtil.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
// import { logger } from '../../functions/logger.js';


export default class MyCommand extends DualCommand {
	constructor(context) {
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) { // eslint-disable-line no-unused-vars
		// do stuff
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) { // eslint-disable-line no-unused-vars
		// do stuff
	}
}
