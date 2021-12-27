import { SlashCommandBuilder } from '@discordjs/builders';
import { optionalIgnOption, skyblockProfileOption } from '../../structures/commands/commonOptions';
import { getSenitherWeight, seconds } from '../../functions';
import BaseWeightCommand from './~base-weight';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class WeightCommand extends BaseWeightCommand {
	override weightType = 'Senither';
	override getWeight = getSenitherWeight;

	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's senither weight: total, weight and overflow")
					.addStringOption(optionalIgnOption)
					.addStringOption(skyblockProfileOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['senither'],
				args: false,
				usage: '<`IGN`> <`profile` name>',
			},
		);
	}
}
