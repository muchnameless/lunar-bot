'use strict';

const { stripIndents } = require('common-tags');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class RankCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'request' ],
			description: 'request a guild rank or list all requestable ranks',
			args: false,
			usage: '<`rank name` to request>',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message
	 * @param {boolean} showAll
	 * @param {import('../../structures/database/models/HypixelGuild')} hypixelGuild
	 */
	_run(message, showAll, hypixelGuild) {
		if (showAll) {
			return message.reply(stripIndents`
				Requestable guild ranks: (\`${this.config.get('PREFIX')}${this.name} [rank name]\`)
				${hypixelGuild.ranks
					.filter(({ roleID }) => roleID)
					.map(({ name, weightReq }) => ` • ${name}: ${this.client.formatNumber(weightReq)} weight`)
					.join('\n')}
			`);
		}

		return hypixelGuild.handleRankRequestMessage(message);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const hypixelGuild = message.author.player?.guild ?? this.client.hypixelGuilds.mainGuild;

		return this._run(message, !args.length, hypixelGuild);
	}
};
