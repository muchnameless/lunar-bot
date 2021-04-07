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
			const { stats: { SkyWars: { wins = 0, losses = 0, games_played_skywars: games = 0, kills = 0, deaths = 0, win_streak: winStreak = 0 } } } = data;

			return oneLine`
				${ign}:
				SkyWars:
				level: ${this.client.formatNumber(getSkyWarsLevelInfo(data).level)},
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(losses)},
				win rate: ${this.client.formatDecimalNumber(wins / (wins + losses))},
				kills: ${this.client.formatNumber(kills)},
				deaths: ${this.client.formatNumber(deaths)},
				K/D: ${this.calculateKD(kills, deaths) ?? '-/-'},
				games played: ${this.client.formatNumber(games)},
				win streak: ${this.client.formatNumber(winStreak)}
			`;
		} catch {
			return `\`${ign}\` has no SkyWars stats`;
		}
	}
};
