'use strict';

const { Constants } = require('discord.js');
const { oneLine } = require('common-tags');
const BedWarsStatsCommand = require('./bedwars-stats');
// const logger = require('../../functions/logger');


module.exports = class MurderMysteryStatsCommand extends BedWarsStatsCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s MurderMystery stats',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | minecraftUUID',
					required: false,
				}],
				defaultPermission: true,
				cooldown: 1,
			},
			{
				aliases: [ 'mmstats' ],
				args: false,
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * @param {string} ign
	 * @param {import('@zikeji/hypixel').Components.Schemas.Player} data
	 */
	generateReply(ign, data) {
		try {
			const { games, wins = 0, kills, deaths } = data.stats.MurderMystery ?? {};

			if (!games) return `\`${ign}\` has no MurderMystery stats`;

			return oneLine`
				${ign}:
				MurderMystery:
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(games - wins)},
				winrate: ${this.client.formatDecimalNumber(wins / games)},
				games played: ${this.client.formatNumber(games)},
				kills: ${this.client.formatNumber(kills ?? 0)},
				deaths: ${this.client.formatNumber(deaths ?? 0)},
				K/D: ${this.calculateKD(kills, deaths)},
				murderer wins: ${this.client.formatNumber(data.stats.MurderMystery.murderer_wins ?? 0)},
				detective wins: ${this.client.formatNumber(data.stats.MurderMystery.detective_wins ?? 0)},
				coins: ${this.client.formatNumber(data.stats.MurderMystery.coins ?? 0)},
				fastest murderer win: ${this.client.formatNumber(data.stats.MurderMystery.quickest_murderer_win_time_seconds ?? '-/-')} s,
				fastest detective win: ${this.client.formatNumber(data.stats.MurderMystery.quickest_detective_win_time_seconds ?? '-/-')} s
			`;
		} catch {
			return `\`${ign}\` has no MurderMystery stats`;
		}
	}
};
