'use strict';

const RankCommand = require('../../../../commands/user/rank');
// const logger = require('../../../../functions/logger');


module.exports = class BridgeRankCommand extends RankCommand {
	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		return this._run(message, !args.length, message.chatBridge.guild);
	}
};
