'use strict';

const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class TestCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'debug' ],
			description: 'dynamic test function',
			args: false,
			usage: '<test `arguments`>',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async run(message, args) { // eslint-disable-line no-unused-vars
		return;
	}
};
