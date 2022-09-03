import { oneLine } from 'common-tags';
import { SlashCommandBuilder } from 'discord.js';
import BaseStatsCommand, { type FetchedData } from './~base-stats-command.js';
import { escapeIgn, formatDecimalNumber, formatNumber, seconds } from '#functions';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalIgnOption } from '#structures/commands/commonOptions.js';

interface MurderMysteryStats {
	coins: number;
	deaths: number;
	detective_wins: number;
	games: number;
	kills: number;
	murderer_wins: number;
	quickest_detective_win_time_seconds: number | string;
	quickest_murderer_win_time_seconds: number | string;
	wins: number;
}

export default class MurderMysteryStatsCommand extends BaseStatsCommand {
	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's MurderMystery stats")
					.addStringOption(optionalIgnOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['mmstats'],
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected override _generateReply({ ign, playerData }: FetchedData) {
		if (!playerData?.stats?.MurderMystery) return `\`${ign}\` has no MurderMystery stats`;

		try {
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
				${escapeIgn(ign)}:
				MurderMystery:
				wins: ${formatNumber(wins)},
				losses: ${formatNumber(games - wins)},
				winrate: ${formatDecimalNumber(wins / games)},
				games played: ${formatNumber(games)},
				kills: ${formatNumber(kills)},
				deaths: ${formatNumber(deaths)},
				K/D: ${this.calculateKD(kills, deaths)},
				murderer wins: ${formatNumber(murderer_wins)},
				detective wins: ${formatNumber(detective_wins)},
				coins: ${formatNumber(coins)},
				fastest murderer win: ${
					typeof quickest_murderer_win_time_seconds === 'number'
						? formatNumber(quickest_murderer_win_time_seconds)
						: quickest_murderer_win_time_seconds
				} s,
				fastest detective win: ${
					typeof quickest_detective_win_time_seconds === 'number'
						? formatNumber(quickest_detective_win_time_seconds)
						: quickest_detective_win_time_seconds
				} s
			`;
		} catch {
			return `\`${ign}\` has no MurderMystery stats`;
		}
	}
}
