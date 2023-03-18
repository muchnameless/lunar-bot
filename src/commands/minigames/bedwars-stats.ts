import { getBedwarsLevelInfo } from '@zikeji/hypixel';
import { oneLine } from 'common-tags';
import { SlashCommandBuilder } from 'discord.js';
import BaseStatsCommand, { type FetchedData } from './~base-stats-command.js';
import { escapeIgn, formatDecimalNumber, formatNumber, seconds } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalIgnOption } from '#structures/commands/commonOptions.js';

export default class BedWarsStatsCommand extends BaseStatsCommand {
	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's BedWars stats")
					.addStringOption(optionalIgnOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['bwstats'],
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
		if (!playerData?.stats?.Bedwars) return `\`${ign}\` has no BedWars stats`;

		const {
			wins_bedwars = 0,
			losses_bedwars = 0,
			games_played_bedwars = 0,
			final_kills_bedwars = 0,
			final_deaths_bedwars = 0,
			winstreak = 0,
			beds_broken_bedwars = 0,
		} = playerData.stats.Bedwars;

		if (wins_bedwars + losses_bedwars === 0) return `\`${ign}\` has no BedWars stats`;

		return oneLine`
			${escapeIgn(ign)}:
			BedWars:
			level: ${formatNumber(getBedwarsLevelInfo(playerData).level)},
			wins: ${formatNumber(wins_bedwars)},
			losses: ${formatNumber(losses_bedwars)},
			win rate: ${formatDecimalNumber(wins_bedwars / (wins_bedwars + losses_bedwars))},
			games played: ${formatNumber(games_played_bedwars)},
			final kills: ${formatNumber(final_kills_bedwars)},
			final deaths: ${formatNumber(final_deaths_bedwars)},
			overall fkdr: ${this.calculateKD(final_kills_bedwars, final_deaths_bedwars) ?? '-/-'},
			win streak: ${formatNumber(winstreak)},
			beds broken: ${formatNumber(beds_broken_bedwars)}
		`;
	}
}
