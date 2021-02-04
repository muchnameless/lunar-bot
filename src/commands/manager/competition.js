'use strict';

const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class CompetitionCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'comp' ],
			description: 'WIP',
			guildOnly: false,
			args: false,
			usage: '',
			cooldown: 1,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		message.reply('WIP');
	}
};
