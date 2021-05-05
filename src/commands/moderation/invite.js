'use strict';

const { invite: { regExp: invite } } = require('../../structures/chat_bridge/constants/commandResponses');
const SetRankCommand = require('./setrank');
// const logger = require('../../functions/logger');


module.exports = class InviteCommand extends SetRankCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'guildinvite' ],
			description: 'invite someone into the guild',
			args: true,
			usage: () => `[\`IGN\`] <${this.client.hypixelGuilds.guildNamesAsFlags}>`,
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
		const [ IGN ] = args;

		return this._run(message, flags, `g invite ${IGN}`, invite(IGN));
	}
};
