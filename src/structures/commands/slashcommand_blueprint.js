'use strict';

const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class MyCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: '',
			options: [],
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		// do stuff
	}
};
