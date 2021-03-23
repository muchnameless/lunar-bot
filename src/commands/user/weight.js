'use strict';

const weight = require('../../functions/weight');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class WeightCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'w' ],
			description: 'shows a player\'s total weight, weight and overflow',
			args: false,
			usage: '<`IGN`> <`profile` name>',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		return weight(message, args);
	}
};
