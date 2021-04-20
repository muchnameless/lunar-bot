'use strict';

const GuildListCommand = require('./guildlist');
// const logger = require('../../functions/logger');


module.exports = class GuildOnlineCommand extends GuildListCommand {
	constructor(data) {
		super(data, {
			aliases: [ 'online' ],
			description: 'guild online',
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
		return this._run(message, rawArgs, 'g online');
	}
};
