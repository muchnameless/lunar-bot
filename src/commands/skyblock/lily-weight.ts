import { SlashCommandBuilder } from 'discord.js';
import { getLilyWeight, seconds } from '#functions';
import BaseWeightCommand from './~base-weight';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class LilyWeightCommand extends BaseWeightCommand {
	override weightType = 'Lily';
	override getWeight = getLilyWeight;

	constructor(context: CommandContext) {
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
