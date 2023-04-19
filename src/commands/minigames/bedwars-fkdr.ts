import { SlashCommandBuilder } from 'discord.js';
import BaseStatsCommand, { type FetchedData } from './~base-stats-command.js';
import { seconds } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalIgnOption } from '#structures/commands/commonOptions.js';

export default class BedWarsFkdrCommand extends BaseStatsCommand {
	protected readonly statsType = 'BedWars';

	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's BedWars fkdr")
					.addStringOption(optionalIgnOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['fkdr'],
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected override _generateReply({ ign, player: { stats } }: FetchedData) {
		if (!stats?.Bedwars) return this.noStats(ign);

		const reply: string[] = [];

		for (const { name, key } of [
			{ name: 'Overall', key: '' },
			{ name: 'Solo', key: 'eight_one_' },
			{ name: 'Doubles', key: 'eight_two_' },
			{ name: '3s', key: 'four_three_' },
			{ name: '4s', key: 'four_four_' },
		] as const) {
			const kd = this.calculateKD(
				stats.Bedwars[`${key}final_kills_bedwars`] as number,
				stats.Bedwars[`${key}final_deaths_bedwars`] as number,
			);
			if (kd) reply.push(`${name}: ${kd}`);
		}

		if (!reply.length) return this.noStats(ign);

		return {
			ign,
			reply,
		};
	}
}
