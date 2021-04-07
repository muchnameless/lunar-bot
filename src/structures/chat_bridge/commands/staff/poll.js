'use strict';

const PollCommand = require('../../../../commands/staff/poll');
// const logger = require('../../../../functions/logger');


module.exports = class BridgePollCommand extends PollCommand {
	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		this.createPoll(message.chatBridge, message, args, message.author.ign);
	}
};
