'use strict';

const DualCommand = require('../../structures/commands/DualCommand');
// const logger = require('../../functions/logger');


module.exports = class MyCommand extends DualCommand {
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
				args: false,
				usage: '',
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
	 */
	async runInGame(message) { // eslint-disable-line no-unused-vars
		// do stuff
	}
};
