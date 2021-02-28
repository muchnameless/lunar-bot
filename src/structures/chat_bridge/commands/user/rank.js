'use strict';

const handleRankRequest = require('../../functions/handleRankRequest');
const IngameCommand = require('../../IngameCommand');
const logger = require('../../../../functions/logger');


module.exports = class RankCommand extends IngameCommand {
	constructor(data) {
		super(data, {
			aliases: [ 'request' ],
			description: 'request a guild rank',
			args: true,
			usage: '[rank name]',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../../LunarClient')} client
	 * @param {import('../../../database/managers/ConfigManager')} config
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		handleRankRequest(message);
	}
};
