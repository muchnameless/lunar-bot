'use strict';

const Command = require('../../../commands/Command');
// const logger = require('../../../../functions/logger');


module.exports = class MathCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'calc' ],
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
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const INPUT = rawArgs.join('').replace(/[^\d+\-*/%.()]/g, '');
		const OUTPUT = eval(INPUT);

		message.reply(`${INPUT} = ${OUTPUT}`);
	}
};
