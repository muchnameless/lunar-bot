'use strict';

const { FLUSHED } = require('../../constants/emojiCharacters');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class BbCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'qt' ],
			description: 'flushed',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		message.channel.send(FLUSHED).catch(logger.error);
	}
};
