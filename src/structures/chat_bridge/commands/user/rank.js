'use strict';

const { stripIndents } = require('common-tags');
const handleRankRequest = require('../../functions/handleRankRequest');
const Command = require('../../../commands/Command');
// const logger = require('../../../../functions/logger');


module.exports = class RankCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'request' ],
			description: 'request a guild rank or list all requestable ranks',
			args: false,
			usage: '<\'rank name\' to request>',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args) {
		if (!args.length) {
			const { chatBridge: { guild } } = message;

			message.reply(stripIndents`
				Requestable guild ranks:
				${guild.ranks
					.filter(rank => rank.roleID)
					.map(({ name, weightReq }) => ` > ${name}: ${this.client.formatNumberClean(weightReq)} weight`)
					.join('\n')
				}
			`);
		}

		handleRankRequest(message);
	}
};
