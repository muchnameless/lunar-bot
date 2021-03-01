'use strict';

const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class StopCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'stop the bot. It should restart immediatly',
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
	async run(message, args, flags, rawArgs) {
		await message.reply('stopping the bot.').catch(logger.error);
		this.client.db.closeConnectionAndExit();
	}
};
