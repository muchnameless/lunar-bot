import { getSkyWarsLevelInfo } from '@zikeji/hypixel';
import { oneLine } from 'common-tags';
import { SlashCommandBuilder } from 'discord.js';
import { escapeIgn, formatDecimalNumber, formatNumber, seconds } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalIgnOption } from '#structures/commands/commonOptions.js';
import BaseStatsCommand, { type FetchedData } from './~base-stats-command.js';

interface SkyWarsStats {
	assists: number;
	deaths: number;
	games_played_skywars: number;
	kills: number;
	losses: number;
	win_streak: number;
	wins: number;
}

export default class SkyWarsStatsCommand extends BaseStatsCommand {
	protected readonly statsType = 'SkyWars';

	public constructor(context: CommandContext) {
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
	 *
	 * @param data
	 */
	protected override _generateReply({ ign, player }: FetchedData) {
		if (!player.stats?.SkyWars) return this.noStats(ign);

		try {
			const {
				wins = 0,
				losses = 0,
				assists = 0,
				games_played_skywars = 0,
				kills = 0,
				deaths = 0,
				win_streak = 0,
			} = player.stats.SkyWars as unknown as SkyWarsStats;

			return {
				ign,
				reply: [
					`level: ${formatNumber(getSkyWarsLevelInfo(player).level)}`,
					`wins: ${formatNumber(wins)}`,
					`losses: ${formatNumber(losses)}`,
					`win rate: ${formatDecimalNumber(wins / (wins + losses))}`,
					`kills: ${formatNumber(kills)}`,
					`assists: ${formatNumber(assists)}`,
					`deaths: ${formatNumber(deaths)}`,
					`K/D: ${this.calculateKD(kills, deaths) ?? '-/-'}`,
					`games played: ${formatNumber(games_played_skywars)}`,
					`win streak: ${formatNumber(win_streak)}`,
				],
			};
		} catch {
			return this.noStats(ign);
		}
	}
}
