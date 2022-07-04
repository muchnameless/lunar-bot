import { SlashCommandBuilder } from 'discord.js';
import { oneLine } from 'common-tags';
import { getBedwarsLevelInfo } from '@zikeji/hypixel';
import { optionalIgnOption } from '#structures/commands/commonOptions';
import { escapeIgn, formatDecimalNumber, formatNumber, seconds } from '#functions';
import BaseStatsCommand from './~base-stats-command';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { FetchedData } from './~base-stats-command';

export default class BedWarsStatsCommand extends BaseStatsCommand {
	constructor(context: CommandContext) {
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
	 * @param data
	 */
	override _generateReply({ ign, playerData }: FetchedData) {
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

		// eslint-disable-next-line camelcase
		if (wins_bedwars + losses_bedwars === 0) return `\`${ign}\` has no BedWars stats`;

		return oneLine`
			${escapeIgn(ign)}:
			BedWars:
			level: ${formatNumber(getBedwarsLevelInfo(playerData).level)},
			wins: ${formatNumber(wins_bedwars)},
			losses: ${formatNumber(losses_bedwars)},
			win rate: ${
				// eslint-disable-next-line camelcase
				formatDecimalNumber(wins_bedwars / (wins_bedwars + losses_bedwars))
			},
			games played: ${formatNumber(games_played_bedwars)},
			final kills: ${formatNumber(final_kills_bedwars)},
			final deaths: ${formatNumber(final_deaths_bedwars)},
			overall fkdr: ${this.calculateKD(final_kills_bedwars, final_deaths_bedwars) ?? '-/-'},
			win streak: ${formatNumber(winstreak)},
			beds broken: ${formatNumber(beds_broken_bedwars)}
		`;
	}
}
