import { SlashCommandBuilder } from 'discord.js';
import { oneLine } from 'common-tags';
import { getSkyWarsLevelInfo } from '@zikeji/hypixel';
import { optionalIgnOption } from '#structures/commands/commonOptions';
import { escapeIgn, formatDecimalNumber, formatNumber, seconds } from '#functions';
import BaseStatsCommand from './~base-stats-command';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { FetchedData } from './~base-stats-command';

interface SkyWarsStats {
	wins: number;
	losses: number;
	assists: number;
	games_played_skywars: number;
	kills: number;
	deaths: number;
	win_streak: number;
}

export default class SkyWarsStatsCommand extends BaseStatsCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's SkyWars stats")
					.addStringOption(optionalIgnOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['swstats'],
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * data -> reply
	 * @param data
	 */
	override _generateReply({ ign, playerData }: FetchedData) {
		if (!playerData?.stats?.SkyWars) return `\`${ign}\` has no SkyWars stats`;

		try {
			const {
				wins = 0,
				losses = 0,
				assists = 0,
				games_played_skywars = 0,
				kills = 0,
				deaths = 0,
				win_streak = 0,
			} = playerData.stats.SkyWars as unknown as SkyWarsStats;

			return oneLine`
				${escapeIgn(ign)}:
				SkyWars:
				level: ${formatNumber(getSkyWarsLevelInfo(playerData).level)},
				wins: ${formatNumber(wins)},
				losses: ${formatNumber(losses)},
				win rate: ${formatDecimalNumber(wins / (wins + losses))},
				kills: ${formatNumber(kills)},
				assists: ${formatNumber(assists)},
				deaths: ${formatNumber(deaths)},
				K/D: ${this.calculateKD(kills, deaths) ?? '-/-'},
				games played: ${formatNumber(games_played_skywars)},
				win streak: ${formatNumber(win_streak)}
			`;
		} catch {
			return `\`${ign}\` has no SkyWars stats`;
		}
	}
}
