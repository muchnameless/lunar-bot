'use strict';

const GuildLogCommand = require('../moderation/guildlog');
// const logger = require('../../functions/logger');


module.exports = class GuildQuestCommand extends GuildLogCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'gquest' ],
			description: 'guild quest',
			args: false,
			usage: () => `<${this.client.hypixelGuilds.guildNamesAsFlags}>`,
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
		return this._run(message, args, flags, 'g quest');
	}
};
