import { SlashCommandBuilder } from 'discord.js';
import BaseWeightCommand from './~base-weight.js';
import { getSenitherWeight, seconds } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand.js';

export default class WeightCommand extends BaseWeightCommand {
	protected override readonly weightType = 'Senither';

	protected override readonly _getWeight = getSenitherWeight;

	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder().setDescription("shows a player's senither weight: total, weight and overflow"),
				cooldown: seconds(1),
			},
			{
				aliases: ['senither'],
			},
		);
	}
}
