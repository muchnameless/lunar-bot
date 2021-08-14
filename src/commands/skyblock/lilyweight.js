import { Constants } from 'discord.js';
import { getLilyWeight } from '../../functions/skyblock.js';
import BaseWeightCommand from './~base-weight.js';
// import { logger } from '../../functions/logger.js';


export default class LilyWeightCommand extends BaseWeightCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s lily weight: total, weight and overflow',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | UUID',
					required: false,
				}, BaseWeightCommand.SKYBLOCK_PROFILE_OPTION ],
				cooldown: 1,
			},
			{
				aliases: [ 'lily' ],
				args: false,
				usage: '<`IGN`> <`profile` name>',
			},
		);
	}

	/**
	 * @param {import('@zikeji/hypixel').Components.Schemas.SkyBlockProfileMember} skyblockMember
	 */
	getWeight(skyblockMember) { // eslint-disable-line class-methods-use-this
		return getLilyWeight(skyblockMember);
	}
}
