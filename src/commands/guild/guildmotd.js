'use strict';

const GuildLogCommand = require('../moderation/guildlog');
// const logger = require('../../functions/logger');


module.exports = class GuildMotdCommand extends GuildLogCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'gmotd' ],
			description: 'guild motd',
			args: false,
			usage: '',
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
		return this._run(message, args, flags, 'g motd');
	}
};
