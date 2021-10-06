import { SlashCommandBuilder } from '@discordjs/builders';
import { optionalIgnOption, skyblockProfileOption } from '../../structures/commands/commonOptions';
import { getSenitherWeight, seconds } from '../../functions';
import BaseWeightCommand from './~base-weight';
import type { Components } from '@zikeji/hypixel';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class WeightCommand extends BaseWeightCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows a player\'s senither weight: total, weight and overflow')
				.addStringOption(optionalIgnOption)
				.addStringOption(skyblockProfileOption),
			cooldown: seconds(1),
		}, {
			aliases: [ 'w' ],
			args: false,
			usage: '<`IGN`> <`profile` name>',
		});
	}

	/**
	 * @param skyblockMember
	 */
	override getWeight(skyblockMember: Components.Schemas.SkyBlockProfileMember) { // eslint-disable-line class-methods-use-this
		return getSenitherWeight(skyblockMember);
	}
}
