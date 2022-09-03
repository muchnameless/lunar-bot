import { type Components } from '@zikeji/hypixel';
import { oneLine } from 'common-tags';
import { SlashCommandBuilder } from 'discord.js';
import BaseStatsCommand, { type FetchedData } from './~base-stats-command.js';
import { escapeIgn, formatDecimalNumber, formatNumber, seconds } from '#functions';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalIgnOption } from '#structures/commands/commonOptions.js';

export default class BridgeStatsCommand extends BaseStatsCommand {
	public constructor(context: CommandContext) {
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
	private _calculateStats(duelStats: Components.Schemas.PlayerStatsGameMode, stat: string) {
		return ['duel', 'doubles', 'four'].reduce(
			(acc, cur) => acc + ((duelStats[`bridge_${cur}_${stat}`] as number | undefined) ?? 0),
			0,
		);
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected override _generateReply({ ign, playerData }: FetchedData) {
		if (!playerData?.stats?.Duels) return `\`${ign}\` has no Bridge stats`;

		try {
			const { bridge_deaths: deaths, bridge_kills: kills } = playerData.stats.Duels;

			if (typeof deaths !== 'number' || typeof kills !== 'number') return `\`${ign}\` has no Bridge stats`;

			const wins = this._calculateStats(playerData.stats.Duels, 'wins');
			const losses = this._calculateStats(playerData.stats.Duels, 'losses');
			const gamesPlayed = this._calculateStats(playerData.stats.Duels, 'rounds_played');

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
				goals: ${formatNumber(this._calculateStats(playerData.stats.Duels, 'goals'))}
			`;
		} catch {
			return `\`${ign}\` has no Bridge stats`;
		}
	}
}
