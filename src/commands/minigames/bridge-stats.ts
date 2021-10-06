import { SlashCommandBuilder } from '@discordjs/builders';
import { oneLine } from 'common-tags';
import { optionalIgnOption } from '../../structures/commands/commonOptions';
import { seconds } from '../../functions';
import BaseStatsCommand from './~base-stats-command';
import type { Components } from '@zikeji/hypixel';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { FetchedData } from './~base-stats-command';


export default class BridgeStatsCommand extends BaseStatsCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows a player\'s Bridge stats')
				.addStringOption(optionalIgnOption),
			cooldown: seconds(1),
		}, {
			aliases: [ 'bridge' ],
			args: false,
			usage: '<`IGN`>',
		});
	}

	/**
	 * @param duelStats
	 * @param stat
	 */
	static _calculateStats(duelStats: Components.Schemas.PlayerStatsGameMode, stat: string) {
		return [ 'duel', 'doubles', 'four' ].reduce((acc, cur) => acc + (duelStats[`bridge_${cur}_${stat}`] as number ?? 0), 0);
	}

	override _generateReply({ ign, playerData }: FetchedData) {
		if (!playerData?.stats?.Duels) return `\`${ign}\` has no Bridge stats`;

		try {
			const {
				bridge_deaths: deaths,
				bridge_kills: kills,
			} = playerData.stats.Duels;

			if (deaths == null || kills == null) return `\`${ign}\` has no Bridge stats`;

			const wins = BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'wins');
			const losses = BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'losses');
			const gamesPlayed = BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'rounds_played');

			return oneLine`
				${ign}:
				Bridge:
				wins: ${this.client.formatNumber(wins)},
				losses: ${this.client.formatNumber(losses)},
				ties: ${this.client.formatNumber(gamesPlayed - (wins + losses))},
				win rate: ${this.client.formatDecimalNumber(wins / (wins + losses))},
				games played: ${this.client.formatNumber(gamesPlayed)},
				kills: ${this.client.formatNumber(kills as number)},
				deaths: ${this.client.formatNumber(deaths as number)},
				kd ratio: ${this.calculateKD(kills as number, deaths as number) ?? '-/-'},
				goals: ${this.client.formatNumber(BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'goals'))}
			`;
		} catch {
			return `\`${ign}\` has no Bridge stats`;
		}
	}
}
