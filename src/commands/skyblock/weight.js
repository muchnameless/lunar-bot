import { SlashCommandBuilder } from '@discordjs/builders';
import { getSenitherWeight } from '../../functions/skyblock.js';
import { optionalIgnOption, skyblockProfileOption } from '../../structures/commands/commonOptions.js';
// import { InteractionUtil } from '../../util/InteractionUtil.js';
import BaseWeightCommand from './~base-weight.js';
// import { logger } from '../../functions/logger.js';


export default class WeightCommand extends BaseWeightCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows a player\'s senither weight: total, weight and overflow')
				.addStringOption(optionalIgnOption)
				.addStringOption(skyblockProfileOption),
			cooldown: 1,
		}, {
			aliases: [ 'w' ],
			args: false,
			usage: '<`IGN`> <`profile` name>',
		});
	}

	/**
	 * @param {import('@zikeji/hypixel').Components.Schemas.SkyBlockProfileMember} skyblockMember
	 */
	getWeight(skyblockMember) { // eslint-disable-line class-methods-use-this
		return getSenitherWeight(skyblockMember);
	}
}
