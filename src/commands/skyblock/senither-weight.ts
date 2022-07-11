import { SlashCommandBuilder } from 'discord.js';
import { getSenitherWeight, seconds } from '#functions';
import BaseWeightCommand from './~base-weight';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class WeightCommand extends BaseWeightCommand {
	override weightType = 'Senither';
	override getWeight = getSenitherWeight;

	constructor(context: CommandContext) {
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
