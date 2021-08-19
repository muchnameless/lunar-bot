import { SlashCommandBuilder } from '@discordjs/builders';
import { oneLine } from 'common-tags';
import { optionalIgnOption } from '../../structures/commands/commonOptions.js';
// import { InteractionUtil } from '../../util/InteractionUtil.js';
import BaseStatsCommand from './~base-stats-command.js';
// import { logger } from '../../functions/logger.js';


export default class MurderMysteryStatsCommand extends BaseStatsCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows a player\'s MurderMystery stats')
				.addStringOption(optionalIgnOption),
			cooldown: 1,
		}, {
			aliases: [ 'mmstats' ],
			args: false,
			usage: '<`IGN`>',
		});
	}

	/**
	 * @param {import('./~base-stats-command').FetchedData} param0
	 */
	_generateReply({ ign, playerData }) {
		if (!playerData?.stats?.MurderMystery) return `\`${ign}\` has no MurderMystery stats`;

		try {
			/* eslint-disable camelcase */
			const {
				games = 0,
				wins = 0,
				kills = 0,
				deaths = 0,
				murderer_wins = 0,
				detective_wins = 0,
				coins = 0,
				quickest_murderer_win_time_seconds = '-/-',
				quickest_detective_win_time_seconds = '-/-',
			} = playerData.stats.MurderMystery;

			if (!games) return `\`${ign}\` has no MurderMystery stats`;

			return oneLine`
				${ign}:
				MurderMystery:
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(games - wins)},
				winrate: ${this.client.formatDecimalNumber(wins / games)},
				games played: ${this.client.formatNumber(games)},
				kills: ${this.client.formatNumber(kills)},
				deaths: ${this.client.formatNumber(deaths)},
				K/D: ${this.calculateKD(kills, deaths)},
				murderer wins: ${this.client.formatNumber(murderer_wins)},
				detective wins: ${this.client.formatNumber(detective_wins)},
				coins: ${this.client.formatNumber(coins)},
				fastest murderer win: ${this.client.formatNumber(quickest_murderer_win_time_seconds)} s,
				fastest detective win: ${this.client.formatNumber(quickest_detective_win_time_seconds)} s
			`;
			/* eslint-enable camelcase */
		} catch {
			return `\`${ign}\` has no MurderMystery stats`;
		}
	}
}
