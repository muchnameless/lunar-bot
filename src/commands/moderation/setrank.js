'use strict';

const { setRank: { regExp: setRank } } = require('../../structures/chat_bridge/constants/commandResponses');
const GuildCommand = require('../guild/guild');
// const logger = require('../../functions/logger');


module.exports = class SetRankCommand extends GuildCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'guildsetrank' ],
			description: 'set a rank of a guild member',
			args: 2,
			usage: () => `[\`IGN\`|\`discord id\`|\`@mention\`] [\`rank\` name] <${this.collection.constructor.forceFlagsAsFlags} to disable IGN autocorrection> <${this.client.hypixelGuilds.guildNamesAsFlags}>`,
			cooldown: 0,
		});
	}

	/**
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @returns {string}
	 */
	getIGN(message, args, flags) {
		return message.mentions.users.size
			? message.messages.users.first().player?.ign
			: (this.force(flags)
				? args[0]
				: (this.client.players.getByID(args[0])?.ign ?? this.client.players.getByIGN(args[0])?.ign ?? args[0])
			);
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
			command: `g setrank ${IGN} ${args[1]}`,
			responseRegExp: setRank(IGN, undefined, args[1]),
		});
	}
};
