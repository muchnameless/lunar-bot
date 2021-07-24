'use strict';

const { Constants } = require('discord.js');
const { oneLine } = require('common-tags');
const { getBedwarsLevelInfo } = require('@zikeji/hypixel');
const StatsCommand = require('./~stats-command.js');
const logger = require('../../functions/logger');


module.exports = class BedWarsStatsCommand extends StatsCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s BedWars stats',
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
				aliases: [ 'bwstats' ],
				args: false,
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * @param {StatsCommand.FetchedData} param0
	 */
	_generateReply({ ign, playerData }) {
		if (!playerData?.stats?.Bedwars) return `\`${ign}\` has no BedWars stats`;

		try {
			/* eslint-disable camelcase */
			const {
				wins_bedwars = 0,
				losses_bedwars = 0,
				games_played_bedwars = 0,
				final_kills_bedwars = 0,
				final_deaths_bedwars = 0,
				winstreak = 0,
				beds_broken_bedwars = 0,
			} = playerData.stats.Bedwars;

			return oneLine`
				${ign}:
				BedWars:
				level: ${this.client.formatNumber(getBedwarsLevelInfo(playerData).level)},
				wins: ${this.client.formatNumber(wins_bedwars)},
				losses: ${this.client.formatNumber(losses_bedwars)},
				win rate: ${this.client.formatDecimalNumber(wins_bedwars / (wins_bedwars + losses_bedwars))},
				games played: ${this.client.formatNumber(games_played_bedwars)},
				final kills: ${this.client.formatNumber(final_kills_bedwars)},
				final deaths: ${this.client.formatNumber(final_deaths_bedwars)},
				overall fkdr: ${this.calculateKD(final_kills_bedwars, final_deaths_bedwars) ?? '-/-'},
				win streak: ${this.client.formatNumber(winstreak)},
				beds broken: ${this.client.formatNumber(beds_broken_bedwars)}
			`;
			/* eslint-enable camelcase */
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]`, error);

			return `${error}`;
		}
	}
};
