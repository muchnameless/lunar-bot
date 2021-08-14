import { DualCommand } from '../../structures/commands/DualCommand.js';
// import { logger } from '../../functions/logger.js';


export default class MyCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: '',
				options: [],
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
	 * @param {import('discord.js').CommandInteraction | import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} ctx
	 */
	async _run(ctx) { // eslint-disable-line no-unused-vars
		// do stuff
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		// do stuff
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} message
	 */
	async runInGame(message) { // eslint-disable-line no-unused-vars
		// do stuff
	}
}
