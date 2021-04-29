'use strict';

const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class WeightCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'cf', 'flip' ],
			description: 'heads or tails or ?',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	static generateReply() {
		const randomNumber = Math.floor(Math.random() * 1001);

		if (randomNumber === 0) return 'edge';
		if (randomNumber <= 500) return 'heads';
		return 'tails';
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		return message.reply(WeightCommand.generateReply());
	}
};
