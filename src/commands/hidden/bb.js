'use strict';

const { FLUSHED } = require('../../constants/emojiCharacters');
const Command = require('../../structures/commands/Command');
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

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/ConfigHandler')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		message.channel.send(FLUSHED).catch(logger.error);
	}
};
