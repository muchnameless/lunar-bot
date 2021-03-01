'use strict';

const Command = require('../../../commands/Command');
const logger = require('../../../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: '',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) {
		// do stuff
	}
};
