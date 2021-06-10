'use strict';

const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class StopCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'stop the bot. It should restart immediatly',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async run(message, args) { // eslint-disable-line no-unused-vars
		try {
			await message.reply('stopping the bot');
		} catch (error) {
			logger.error(error);
		} finally {
			this.client.exit();
		}
	}
};
