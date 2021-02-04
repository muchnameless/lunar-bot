'use strict';

const { closeConnectionAndExit } = require('../../../database/models/index');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'stop the bot. It should restart immediatly',
			cooldown: 0,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		await message.reply('stopping the bot.').catch(logger.error);
		closeConnectionAndExit();
	}
};
