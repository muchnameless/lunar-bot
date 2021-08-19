import { SlashCommandBuilder } from '@discordjs/builders';
import { optionalIgnOption } from '../../structures/commands/commonOptions.js';
// import { InteractionUtil } from '../../util/InteractionUtil.js';
import BaseStatsCommand from './~base-stats-command.js';
// import { logger } from '../../functions/logger.js';


export default class BedWarsFkdrCommand extends BaseStatsCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows a player\'s BedWars fkdr')
				.addStringOption(optionalIgnOption),
			cooldown: 1,
		}, {
			aliases: [ 'fkdr' ],
			args: false,
			usage: '<`IGN`>',
		});
	}

	/**
	 * @param {import('./~base-stats-command').FetchedData} param0
	 */
	_generateReply({ ign, playerData }) {
		if (!playerData?.stats?.Bedwars) return `\`${ign}\` has no BedWars stats`;

		try {
			const kds = [
				{ name: 'Overall', key: '' },
				{ name: 'Solo', key: 'eight_one_' },
				{ name: 'Doubles', key: 'eight_two_' },
				{ name: '3s', key: 'four_three_' },
				{ name: '4s', key: 'four_four_' },
			].flatMap(({ name, key }) => {
				const kd = this.calculateKD(playerData.stats.Bedwars[`${key}final_kills_bedwars`], playerData.stats.Bedwars[`${key}final_deaths_bedwars`]);

				return kd !== null
					? ({ name, kd })
					: [];
			});

			if (!kds.length) return `\`${ign}\` has no BedWars stats`;

			return `${ign}: BedWars: ${kds.map(({ name, kd }) => `${name}: ${kd}`).join(', ')}`;
		} catch {
			return `\`${ign}\` has no BedWars stats`;
		}
	}
}
