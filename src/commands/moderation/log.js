'use strict';

const { logErrors: { regExp: logErrors } } = require('../../structures/chat_bridge/constants/commandResponses');
const GuildCommand = require('../guild/guild');
// const logger = require('../../functions/logger');


module.exports = class GuildLogCommand extends GuildCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'guildlog' ],
			description: 'guild log',
			args: false,
			usage: () => `<\`IGN\`> <page \`number\`> <${this.client.hypixelGuilds.guildNamesAsFlags}>`,
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
		return this._run(message, flags, {
			command: `g log ${args.join(' ')}`,
			abortRegExp: logErrors(),
		});
	}
};
