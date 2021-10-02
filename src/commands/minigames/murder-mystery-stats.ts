import { SlashCommandBuilder } from '@discordjs/builders';
import { oneLine } from 'common-tags';
import { optionalIgnOption } from '../../structures/commands/commonOptions';
import BaseStatsCommand from './~base-stats-command';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { FetchedData } from './~base-stats-command';


/* eslint-disable camelcase */
interface MurderMysteryStats {
	games: number;
	wins: number;
	kills: number;
	deaths: number;
	murderer_wins: number;
	detective_wins: number;
	coins: number;
	quickest_murderer_win_time_seconds: number | string;
	quickest_detective_win_time_seconds: number | string;
}
/* eslint-enable camelcase */


export default class MurderMysteryStatsCommand extends BaseStatsCommand {
	constructor(context: CommandContext) {
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

	override _generateReply({ ign, playerData }: FetchedData) {
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
			} = playerData.stats.MurderMystery as unknown as MurderMysteryStats;

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
				fastest murderer win: ${typeof quickest_murderer_win_time_seconds === 'number' ? this.client.formatNumber(quickest_murderer_win_time_seconds) : quickest_murderer_win_time_seconds} s,
				fastest detective win: ${typeof quickest_detective_win_time_seconds === 'number' ? this.client.formatNumber(quickest_detective_win_time_seconds) : quickest_detective_win_time_seconds} s
			`;
			/* eslint-enable camelcase */
		} catch {
			return `\`${ign}\` has no MurderMystery stats`;
		}
	}
}
