'use strict';

const { Constants } = require('discord.js');
const { oneLine } = require('common-tags');
const { getSkyWarsLevelInfo } = require('@zikeji/hypixel');
const StatsCommand = require('./~stats-command');
// const logger = require('../../functions/logger');


module.exports = class SkyWarsStatsCommand extends StatsCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s SkyWars stats',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN',
					required: false,
				}],
				cooldown: 1,
			},
			{
				aliases: [ 'swstats' ],
				args: false,
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * @param {StatsCommand.FetchedData} param0
	 */
	_generateReply({ ign, playerData }) {
		if (!playerData?.stats?.SkyWars) return `\`${ign}\` has no SkyWars stats`;

		try {
			/* eslint-disable camelcase */
			const {
				wins = 0,
				losses = 0,
				assists = 0,
				games_played_skywars = 0,
				kills = 0,
				deaths = 0,
				win_streak = 0,
			} = playerData.stats.SkyWars;

			return oneLine`
				${ign}:
				SkyWars:
				level: ${this.client.formatNumber(getSkyWarsLevelInfo(playerData).level)},
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(losses)},
				win rate: ${this.client.formatDecimalNumber(wins / (wins + losses))},
				kills: ${this.client.formatNumber(kills)},
				assists: ${this.client.formatNumber(assists)},
				deaths: ${this.client.formatNumber(deaths)},
				K/D: ${this.calculateKD(kills, deaths) ?? '-/-'},
				games played: ${this.client.formatNumber(games_played_skywars)},
				win streak: ${this.client.formatNumber(win_streak)}
			`;
			/* eslint-enable camelcase */
		} catch {
			return `\`${ign}\` has no SkyWars stats`;
		}
	}
};
