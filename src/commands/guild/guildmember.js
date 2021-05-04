'use strict';

const GuildCommand = require('./guild');
// const logger = require('../../functions/logger');


module.exports = class GuildMemberCommand extends GuildCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'gmember' ],
			description: 'guild member',
			args: false,
			usage: () => `<\`IGN\`> <${this.client.hypixelGuilds.guildNamesAsFlags}>`,
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
		const IGN = args.length
			? args[0]
			: message.author.player?.ign;

		if (!IGN) return message.reply(this.usageInfo);

		return this._run(message, flags, `g member ${IGN}`);
	}
};
