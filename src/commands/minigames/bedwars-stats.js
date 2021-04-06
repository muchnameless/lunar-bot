'use strict';

const { oneLine } = require('common-tags');
const { getBedwarsLevelInfo } = require('@zikeji/hypixel');
const { getUuidAndIgn } = require('../../functions/commands/input');
const hypixel = require('../../api/hypixel');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class BwStatsCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'bwstats' ],
			description: 'shows a player\'s BedWars stats',
			args: false,
			usage: '<`IGN`>',
			cooldown: 1,
		});
	}

	/**
	 * @param {number} kills
	 * @param {number} deaths
	 * @returns {?string}
	 */
	calculateKD(kills, deaths) {
		if (kills == null || deaths == null) return null;
		return this.client.formatDecimalNumber(Math.floor((kills / deaths) * 100) / 100);
	}

	/**
	 * @param {string} ign
	 * @param {import('@zikeji/hypixel').Components.Schemas.Player} data
	 */
	generateReply(ign, data) {
		try {
			const wins = data.stats.Bedwars.wins_bedwars ?? 0;
			const losses = data.stats.Bedwars.losses_bedwars ?? 0;

			return oneLine`
				${ign}:
				BedWards:
				level: ${this.client.formatNumber(getBedwarsLevelInfo(data).level)},
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(losses)},
				win rate: ${this.client.formatDecimalNumber(wins / losses)},
				games played: ${this.client.formatNumber(data.stats.Bedwars.games_played_bedwars ?? 0)},
				final kills: ${this.client.formatNumber(data.stats.Bedwars.final_kills_bedwars ?? 0)},
				final deaths: ${this.client.formatNumber(data.stats.Bedwars.final_deaths_bedwars ?? 0)},
				overall fkdr: ${this.calculateKD(data.stats.Bedwars.final_kills_bedwars, data.stats.Bedwars.final_deaths_bedwars) ?? '-/-'},
				win streak: ${this.client.formatNumber(data.stats.Bedwars.winstreak ?? 0)}
			`;
		} catch {
			return `\`${ign}\` has no BedWars stats`;
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		try {
			const { uuid, ign } = await getUuidAndIgn(message, args);
			const data = await hypixel.player.uuid(uuid);

			return message.reply(this.generateReply(ign, data));
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]: ${error}`);

			return message.reply(`${error}`);
		}
	}
};
