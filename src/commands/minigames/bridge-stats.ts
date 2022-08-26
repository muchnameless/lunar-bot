import { SlashCommandBuilder } from 'discord.js';
import { oneLine } from 'common-tags';
import { optionalIgnOption } from '#structures/commands/commonOptions';
import { escapeIgn, formatDecimalNumber, formatNumber, seconds } from '#functions';
import BaseStatsCommand from './~base-stats-command';
import type { Components } from '@zikeji/hypixel';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { FetchedData } from './~base-stats-command';

export default class BridgeStatsCommand extends BaseStatsCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's Bridge stats")
					.addStringOption(optionalIgnOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['bridge'],
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * @param duelStats
	 * @param stat
	 */
	static _calculateStats(duelStats: Components.Schemas.PlayerStatsGameMode, stat: string) {
		return ['duel', 'doubles', 'four'].reduce(
			(acc, cur) => acc + ((duelStats[`bridge_${cur}_${stat}`] as number | undefined) ?? 0),
			0,
		);
	}

	/**
	 * data -> reply
	 * @param data
	 */
	override _generateReply({ ign, playerData }: FetchedData) {
		if (!playerData?.stats?.Duels) return `\`${ign}\` has no Bridge stats`;

		try {
			const { bridge_deaths: deaths, bridge_kills: kills } = playerData.stats.Duels;

			if (deaths == null || kills == null) return `\`${ign}\` has no Bridge stats`;

			const wins = BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'wins');
			const losses = BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'losses');
			const gamesPlayed = BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'rounds_played');

			return oneLine`
				${escapeIgn(ign)}:
				Bridge:
				wins: ${formatNumber(wins)},
				losses: ${formatNumber(losses)},
				ties: ${formatNumber(gamesPlayed - (wins + losses))},
				win rate: ${formatDecimalNumber(wins / (wins + losses))},
				games played: ${formatNumber(gamesPlayed)},
				kills: ${formatNumber(kills as number)},
				deaths: ${formatNumber(deaths as number)},
				kd ratio: ${this.calculateKD(kills as number, deaths as number) ?? '-/-'},
				goals: ${formatNumber(BridgeStatsCommand._calculateStats(playerData.stats.Duels, 'goals'))}
			`;
		} catch {
			return `\`${ign}\` has no Bridge stats`;
		}
	}
}
