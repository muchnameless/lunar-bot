import { SlashCommandBuilder } from '@discordjs/builders';
import { oneLine } from 'common-tags';
import { getSkyWarsLevelInfo } from '@zikeji/hypixel';
import { optionalIgnOption } from '../../structures/commands/commonOptions';
import { seconds } from '../../functions';
import BaseStatsCommand from './~base-stats-command';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { FetchedData } from './~base-stats-command';


/* eslint-disable camelcase */
interface SkyWarsStats {
	wins: number;
	losses: number;
	assists: number;
	games_played_skywars: number;
	kills: number;
	deaths: number;
	win_streak: number;
}
/* eslint-enable camelcase */


export default class SkyWarsStatsCommand extends BaseStatsCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows a player\'s SkyWars stats')
				.addStringOption(optionalIgnOption),
			cooldown: seconds(1),
		}, {
			aliases: [ 'swstats' ],
			args: false,
			usage: '<`IGN`>',
		});
	}

	override _generateReply({ ign, playerData }: FetchedData) {
		if (!playerData?.stats?.SkyWars) return `\`${ign}\` has no SkyWars stats`;

		try {
			/* eslint-disable camelcase */
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
				${ign}:
				SkyWars:
				level: ${this.client.formatNumber(getSkyWarsLevelInfo(playerData).level)},
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(losses)},
				win rate: ${this.client.formatDecimalNumber(wins / (wins + losses))},
				kills: ${this.client.formatNumber(kills)},
				assists: ${this.client.formatNumber(assists)},
				deaths: ${this.client.formatNumber(deaths)},
				K/D: ${this.calculateKD(kills, deaths) ?? '-/-'},
				games played: ${this.client.formatNumber(games_played_skywars)},
				win streak: ${this.client.formatNumber(win_streak)}
			`;
			/* eslint-enable camelcase */
		} catch {
			return `\`${ign}\` has no SkyWars stats`;
		}
	}
}
