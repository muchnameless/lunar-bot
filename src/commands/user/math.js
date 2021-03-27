'use strict';

const math = require('../../functions/commands/math');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class MathCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'calc' ],
			description: 'supports `+`, `-`, `*`, `/`, `^`, `sin`, `cos`, `tan`, `sqrt`, `exp`, `ln`, `log`, `pi`, `e`',
			args: false,
			usage: '',
			cooldown: 0,
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
		return math(message, rawArgs.join(' '));
	}
};
