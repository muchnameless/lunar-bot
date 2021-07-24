'use strict';

const { Constants } = require('discord.js');
const StatsCommand = require('./~stats-command');
// const logger = require('../../functions/logger');


module.exports = class BedWarsFkdrCommand extends StatsCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s BedWars fkdr',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | UUID',
					required: false,
				}],
				defaultPermission: true,
				cooldown: 1,
			},
			{
				aliases: [ 'fkdr' ],
				args: false,
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * @param {StatsCommand.FetchedData} param0
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
};
