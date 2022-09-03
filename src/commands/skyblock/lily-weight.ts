import { SlashCommandBuilder } from 'discord.js';
import BaseWeightCommand from './~base-weight.js';
import { getLilyWeight, seconds } from '#functions';
import { type CommandContext } from '#structures/commands/BaseCommand.js';

export default class LilyWeightCommand extends BaseWeightCommand {
	protected override readonly weightType = 'Lily';

	protected override readonly _getWeight = getLilyWeight;

	public constructor(context: CommandContext) {
		super(
			context,
			{
				aliases: ['weight'],
				slash: new SlashCommandBuilder().setDescription("shows a player's lily weight: total, weight and overflow"),
				cooldown: seconds(1),
			},
			{
				aliases: ['w', 'weight', 'lily'],
			},
		);
	}
}
