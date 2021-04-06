'use strict';

const BwStatsCommand = require('./bedwars-stats');
// const logger = require('../../functions/logger');


module.exports = class FkdrCommand extends BwStatsCommand {
	constructor(data) {
		super(data, {
			aliases: [ 'fkdr' ],
			description: 'shows a player\'s BedWars fkdr',
			args: false,
			usage: '<`IGN`>',
			cooldown: 1,
		});
	}

	/**
	 * @param {string} ign
	 * @param {import('@zikeji/hypixel').Components.Schemas.Player} data
	 */
	generateReply(ign, data) {
		try {
			const kds = [
				{ name: 'Overall', key: '' },
				{ name: 'Solo', key: 'eight_one_' },
				{ name: 'Doubles', key: 'eight_two_' },
				{ name: '3s', key: 'four_three_' },
				{ name: '4s', key: 'four_four_' },
			].flatMap(({ name, key }) => {
				const kd = this.calculateKD(data.stats.Bedwars[`${key}final_kills_bedwars`], data.stats.Bedwars[`${key}final_deaths_bedwars`]);

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
