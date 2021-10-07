import { SlashCommandBuilder } from '@discordjs/builders';
import { oneLine } from 'common-tags';
import { getBedwarsLevelInfo } from '@zikeji/hypixel';
import { optionalIgnOption } from '../../structures/commands/commonOptions';
import { logger, seconds } from '../../functions';
import BaseStatsCommand from './~base-stats-command';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { FetchedData } from './~base-stats-command';


export default class BedWarsStatsCommand extends BaseStatsCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows a player\'s BedWars stats')
				.addStringOption(optionalIgnOption),
			cooldown: seconds(1),
		}, {
			aliases: [ 'bwstats' ],
			args: false,
			usage: '<`IGN`>',
		});
	}

	override _generateReply({ ign, playerData }: FetchedData) {
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

			if (wins_bedwars + losses_bedwars === 0) return `\`${ign}\` has no BedWars stats`;

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
			logger.error(error, 'bedwars stats cmd');

			return `${error}`;
		}
	}
}
