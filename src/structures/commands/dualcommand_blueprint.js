'use strict';

const DualCommand = require('../../structures/commands/DualCommand');
// const logger = require('../../functions/logger');


module.exports = class MyCommand extends DualCommand {
	/**
	 * @param {import('../../structures/commands/SlashCommand').CommandData} commandData
	 */
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: '',
				options: [],
				defaultPermission: true,
				cooldown: 0,
			},
			{
				aliases: [],
				description: '',
				args: false,
				usage: '',
				cooldown: 0,
			},
		);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 */
	async _run(ctx) { // eslint-disable-line no-unused-vars
		// do stuff
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		// do stuff
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		// do stuff
	}
};
