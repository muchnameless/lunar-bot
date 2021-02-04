'use strict';

const { closeConnectionAndExit } = require('../../../database/models/index');


module.exports = {
	aliases: [ 'terminate' ],
	description: 'stop the bot. It should restart immediatly',
	cooldown: 0,
	execute: async (message, args, flags) => {
		await message.reply('stopping the bot.');
		closeConnectionAndExit();
	},
};
