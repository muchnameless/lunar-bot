'use strict';

const { stripIndents } = require('common-tags');
const fetchur = require('../../functions/fetchur');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'shows current fetchur item',
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
		const { item, timeLeft } = fetchur();

		message.reply(stripIndents`
			item: ${item}
			time left: ${timeLeft}
		`);
	}
};
