'use strict';

const BwStatsCommand = require('./bwstats');
// const logger = require('../../functions/logger');


module.exports = class FkdrCommand extends BwStatsCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'shows a player\'s BedWars fkdr',
			args: false,
			usage: '<`IGN`>',
			cooldown: 1,
		});
	}

	/**
	 * @param {number} kills
	 * @param {number} deaths
	 */
	calculateKD(kills, deaths) {
		if (kills == null || deaths == null) return null;
		return this.client.formatDecimalNumber(Math.floor((kills / deaths) * 100) / 100);
	}

	/**
	 * @param {string} ign
	 * @param {import('@zikeji/hypixel').Components.Schemas.PlayerStatsBedwars} data
	 */
	generateReply(ign, data) {
		const kds = [
			{ name: 'Overall', key: '' },
			{ name: 'Solo', key: 'eight_one_' },
			{ name: 'Doubles', key: 'eight_two_' },
			{ name: '3s', key: 'four_three_' },
			{ name: '4s', key: 'four_four_' },
		].flatMap(({ name, key }) => {
			const kd = this.calculateKD(data[`${key}final_kills_bedwars`], data[`${key}final_deaths_bedwars`]);

			return kd !== null
				? ({ name, kd })
				: [];
		});

		if (!kds.length) return `\`${ign}\` has no bed wars stats`;

		return `${ign}: ${kds.map(({ name, kd }) => `${name}: ${kd}`).join(', ')}`;
	}
};
