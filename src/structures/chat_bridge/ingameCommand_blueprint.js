'use strict';

const IngameCommand = require('../../IngameCommand');
const logger = require('../../../../functions/logger');


module.exports = class MyCommand extends IngameCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: '',
			args: false,
			usage: '',
			cooldown: 0,
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
		// do stuff
	}
};
