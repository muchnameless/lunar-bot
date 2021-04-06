'use strict';

const { oneLine } = require('common-tags');
const { getSkyWarsLevelInfo } = require('@zikeji/hypixel');
const BwStatsCommand = require('./bedwars-stats');
// const logger = require('../../functions/logger');


module.exports = class FkdrCommand extends BwStatsCommand {
	constructor(data) {
		super(data, {
			aliases: [ 'swstats' ],
			description: 'shows a player\'s SkyWars stats',
			args: false,
			usage: '<`IGN`>',
			cooldown: 1,
		});
	}

	/**
	 * @param {string} ign
	 * @param {import('@zikeji/hypixel').Components.Schemas.Player} data
	 */
	generateReply(ign, data) {
		try {
			const wins = data.stats.SkyWars.wins ?? 0;
			const losses = data.stats.SkyWars.losses ?? 0;
			const kills = data.stats.SkyWars.kills ?? 0;
			const deaths = data.stats.SkyWars.deaths ?? 0;

			return oneLine`
				${ign}:
				SkyWars:
				level: ${this.client.formatNumber(getSkyWarsLevelInfo(data).level)},
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(losses)},
				win rate: ${this.client.formatDecimalNumber(wins / losses)},
				kills: ${this.client.formatNumber(kills)},
				deaths: ${this.client.formatNumber(deaths)},
				K/D: ${this.calculateKD(kills, deaths) ?? '-/-'},
				games played: ${this.client.formatNumber(data.stats.SkyWars.games)},
				win streak: ${this.client.formatNumber(data.stats.SkyWars.winstreak ?? 0)}
			`;
		} catch {
			return `\`${ign}\` has no SkyWars stats`;
		}
	}
};
