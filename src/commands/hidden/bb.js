'use strict';

const { FLUSHED } = require('../../constants/emojiCharacters');
const logger = require('../../functions/logger');


module.exports = {
	aliases: [ 'qt' ],
	description: 'flushed',
	cooldown: 0,
	execute: async (message, args, flags) => {
		message.channel.send(FLUSHED).catch(logger.error);
	},
};
