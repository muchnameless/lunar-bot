import type { Components } from '@zikeji/hypixel';
import { SlashCommandBuilder } from 'discord.js';
import BaseStatsCommand, { type FetchedData } from './~base-stats-command.js';
import { formatDecimalNumber, formatNumber, seconds } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalIgnOption } from '#structures/commands/commonOptions.js';

export default class BridgeStatsCommand extends BaseStatsCommand {
	protected readonly statsType = 'Bridge';

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
	protected override _generateReply({ ign, player: { stats } }: FetchedData) {
		if (!stats?.Duels) return this.noStats(ign);

		try {
			const { bridge_deaths, bridge_kills } = stats.Duels;

			if (typeof bridge_deaths !== 'number' || typeof bridge_kills !== 'number') {
				return this.noStats(ign);
			}

			const wins = this._calculateStats(stats.Duels, 'wins');
			const losses = this._calculateStats(stats.Duels, 'losses');
			const gamesPlayed = this._calculateStats(stats.Duels, 'rounds_played');

			return {
				ign,
				reply: [
					`wins: ${formatNumber(wins)}`,
					`losses: ${formatNumber(losses)}`,
					`ties: ${formatNumber(gamesPlayed - (wins + losses))}`,
					`win rate: ${formatDecimalNumber(wins / (wins + losses))}`,
					`games played: ${formatNumber(gamesPlayed)}`,
					`kills: ${formatNumber(bridge_kills)}`,
					`deaths: ${formatNumber(bridge_deaths)}`,
					`kd ratio: ${this.calculateKD(bridge_kills, bridge_deaths) ?? '-/-'}`,
					`goals: ${formatNumber(this._calculateStats(stats.Duels, 'goals'))}`,
				],
			};
		} catch {
			return this.noStats(ign);
		}
	}
}
