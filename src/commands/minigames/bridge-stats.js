'use strict';

const { Constants } = require('discord.js');
const { oneLine } = require('common-tags');
const StatsCommand = require('./~stats-command');
// const logger = require('../../functions/logger');


module.exports = class BridgeStatsCommand extends StatsCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s Bridge stats',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | UUID',
					required: false,
				}],
				defaultPermission: true,
				cooldown: 1,
			},
			{
				aliases: [ 'bridge' ],
				args: false,
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * @param {import('@zikeji/hypixel').Components.Schemas.PlayerStats.Duels} duelStats
	 * @param {string} stat
	 */
	static _calculateStats(duelStats, stat) {
		return [ 'duel', 'doubles', 'four' ].reduce((acc, cur) => acc + (duelStats[`bridge_${cur}_${stat}`] ?? 0), 0);
	}

	/**
	 * @param {StatsCommand.FetchedData} param0
	 */
	_generateReply({ ign, playerData }) {
		if (!playerData?.stats?.Duels) return `\`${ign}\` has no Bridge stats`;

		try {
			const {
				bridge_deaths: deaths,
				bridge_kills: kills,
			} = playerData.stats.Duels;

			if (deaths == null || kills == null) return `\`${ign}\` has no Bridge stats`;

			const wins = BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'wins');
			const losses = BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'losses');
			const gamesPlayed = BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'rounds_played');

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
				goals: ${this.client.formatNumber(BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'goals'))}
			`;
		} catch {
			return `\`${ign}\` has no Bridge stats`;
		}
	}
};
