'use strict';

const { oneLine } = require('common-tags');
const BwStatsCommand = require('./bedwars-stats');
// const logger = require('../../functions/logger');


module.exports = class BridgeStatsCommand extends BwStatsCommand {
	constructor(data) {
		super(data, {
			aliases: [ 'bridge' ],
			description: 'shows a player\'s Bridge stats',
			args: false,
			usage: '<`IGN`>',
			cooldown: 1,
		});
	}

	/**
	 * @param {object} duelStats
	 * @param {string} stat
	 */
	calculateStats(duelStats, stat) {
		return [ 'duel', 'doubles', 'four' ].reduce((acc, cur) => acc + (duelStats[`bridge_${cur}_${stat}`] ?? 0), 0);
	}

	/**
	 * @param {string} ign
	 * @param {import('@zikeji/hypixel').Components.Schemas.Player} data
	 */
	generateReply(ign, data) {
		try {
			const { stats: { Duels: { bridge_deaths: deaths, bridge_kills: kills } } } = data;

			if (deaths == null || kills == null) return `\`${ign}\` has no Bridge stats`;

			const wins = this.calculateStats(data.stats.Duels, 'wins');
			const losses = this.calculateStats(data.stats.Duels, 'losses');
			const gamesPlayed = this.calculateStats(data.stats.Duels, 'rounds_played');

			return oneLine`
				${ign}:
				Bridge:
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(losses)},
				ties: ${this.client.formatNumber(gamesPlayed - (wins + losses))},
				win rate: ${this.client.formatDecimalNumber(wins / (wins + losses))},
				games played: ${this.client.formatNumber(gamesPlayed)},
				kills: ${this.client.formatNumber(kills)},
				deaths: ${this.client.formatNumber(deaths)},
				kd ratio: ${this.calculateKD(kills, deaths) ?? '-/-'},
				goals: ${this.client.formatNumber(this.calculateStats(data.stats.Duels, 'goals'))}
			`;
		} catch {
			return `\`${ign}\` has no Bridge stats`;
		}
	}
};
