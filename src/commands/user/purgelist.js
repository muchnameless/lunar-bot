'use strict';

const { createGainedStatsEmbed, handleLeaderboardCommandMessage } = require('../../functions/leaderboardMessages');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class TracklistCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'purge' ],
			description: 'gained and total weight from members below reqs',
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
	async run(message, args, flags) {
		return handleLeaderboardCommandMessage(message, args, flags, createGainedStatsEmbed, { typeDefault: 'track', pageDefault: Infinity });
	}
};
