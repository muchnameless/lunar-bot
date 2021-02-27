'use strict';

const createPoll = require('../../../../functions/createPoll');
const IngameCommand = require('../../IngameCommand');
const logger = require('../../../../functions/logger');


module.exports = class PollCommand extends IngameCommand {
	constructor(data) {
		super(data, {
			aliases: [ 'polls' ],
			description: 'create a poll for both ingame and discord guild chat',
			args: false,
			usage: '<\'time\'> ["question" "option1" "option2" ...]',
			cooldown: 30,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../../LunarClient')} client
	 * @param {import('../../../database/ConfigHandler')} config
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		createPoll(message.chatBridge, message, args, message.author.ign);
	}
};
