'use strict';

const { stripIndents } = require('common-tags');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class RankCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'request' ],
			description: 'request a guild rank or list all requestable ranks',
			args: false,
			usage: '<`rank name` to request>',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) {
		const hypixelGuild = message.author.player?.guild ?? this.client.hypixelGuilds.cache.first();

		if (!args.length) {
			message.reply(stripIndents`
				Requestable guild ranks:
				${hypixelGuild.ranks.filter(rank => rank.roleID).map(({ name, weightReq }) => ` • ${name}: ${this.client.formatNumber(weightReq)} weight`).join('\n')}
			`);
		}

		hypixelGuild.handleRankRequestMessage(message);
	}
};
