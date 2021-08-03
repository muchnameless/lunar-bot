'use strict';

const { Constants } = require('discord.js');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class TestCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'generic test command',
			options: [{
				name: 'input',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'input',
				required: false,
			}],
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
