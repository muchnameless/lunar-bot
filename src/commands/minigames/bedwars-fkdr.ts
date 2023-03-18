import { SlashCommandBuilder } from 'discord.js';
import BaseStatsCommand, { type FetchedData } from './~base-stats-command.js';
import { escapeIgn, seconds } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalIgnOption } from '#structures/commands/commonOptions.js';

export default class BedWarsFkdrCommand extends BaseStatsCommand {
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
	protected override _generateReply({ ign, playerData }: FetchedData) {
		if (!playerData?.stats?.Bedwars) return `\`${ign}\` has no BedWars stats`;

		try {
			const kds = (
				[
					{ name: 'Overall', key: '' },
					{ name: 'Solo', key: 'eight_one_' },
					{ name: 'Doubles', key: 'eight_two_' },
					{ name: '3s', key: 'four_three_' },
					{ name: '4s', key: 'four_four_' },
				] as const satisfies readonly { key: string; name: string }[]
			)
				.map(({ name, key }) => ({
					name,
					kd: this.calculateKD(
						playerData.stats.Bedwars![`${key}final_kills_bedwars`] as number,
						playerData.stats.Bedwars![`${key}final_deaths_bedwars`] as number,
					),
				}))
				.filter(({ kd }) => kd);

			if (!kds.length) return `\`${ign}\` has no BedWars stats`;

			return `${escapeIgn(ign)}: BedWars: ${kds.map(({ name, kd }) => `${name}: ${kd}`).join(', ')}`;
		} catch {
			return `\`${ign}\` has no BedWars stats`;
		}
	}
}
