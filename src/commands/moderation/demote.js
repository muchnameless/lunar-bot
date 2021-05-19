'use strict';

const { demote: { regExp: demote } } = require('../../structures/chat_bridge/constants/commandResponses');
const SetRankCommand = require('./setrank');
// const logger = require('../../functions/logger');


module.exports = class DemoteCommand extends SetRankCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'guilddemote' ],
			description: 'demote a guild member',
			args: true,
			usage: () => `[\`IGN\`|\`discord id\`|\`@mention\`] <${this.collection.constructor.forceFlagsAsFlags} to disable IGN autocorrection> <${this.client.hypixelGuilds.guildNamesAsFlags}>`,
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
		const IGN = this.getIGN(message, args, flags);

		return this._run(message, flags, {
			command: `g demote ${IGN}`,
			responseRegExp: demote(IGN),
		});
	}
};
