'use strict';

const createPoll = require('../../../../functions/commands/createPoll');
const Command = require('../../../commands/Command');
// const logger = require('../../../../functions/logger');


module.exports = class PollCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'polls' ],
			description: 'create a poll for both ingame and discord guild chat',
			args: true,
			usage: '<30s <= \'duration\' <= 10m> ["question" "option1" "option2" ...]',
			cooldown: 30,
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
		createPoll(message.chatBridge, message, args, message.author.ign);
	}
};
