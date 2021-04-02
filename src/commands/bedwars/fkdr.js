'use strict';

const hypixel = require('../../api/hypixel');
const mojang = require('../../api/mojang');
const MojangAPIError = require('../../structures/errors/MojangAPIError');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class FkdrCommand extends Command {
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
	 * @returns {?string}
	 */
	calculateKD(kills, deaths) {
		if (kills === null || deaths === null) return null;
		return this.client.formatDecimalNumber(Math.floor((kills / deaths) * 100) / 100);
	}

	/**
	 * @param {string} playername
	 * @param {import('@zikeji/hypixel').Components.Schemas.PlayerStatsBedwars} bedwarsData
	 */
	generateReply(playername, bedwarsData) {
		if (!bedwarsData) return `\`${playername}\` has no bed wars stats`;

		const {
			final_kills_bedwars: finalKills = null,
			final_deaths_bedwars: finalDeaths = null,
			eight_one_final_kills_bedwars: eightOneFinalKills = null,
			eight_one_final_deaths_bedwars: eightOneFinalDeaths = null,
			eight_two_final_kills_bedwars: eightTwoFinalKills = null,
			eight_two_final_deaths_bedwars: eightTwoFinalDeaths = null,
			four_three_final_kills_bedwars: fourThreeFinalKills = null,
			four_three_final_deaths_bedwars: fourThreeFinalDeaths = null,
			four_four_final_kills_bedwars: fourFourFinalKills = null,
			four_four_final_deaths_bedwars: fourFourFinalDeaths = null,
		} = bedwarsData;
		const kds = [
			{ name: 'Overall', kd: this.calculateKD(finalKills, finalDeaths) },
			{ name: 'Solo', kd: this.calculateKD(eightOneFinalKills, eightOneFinalDeaths) },
			{ name: 'Doubles', kd: this.calculateKD(eightTwoFinalKills, eightTwoFinalDeaths) },
			{ name: '3s', kd: this.calculateKD(fourThreeFinalKills, fourThreeFinalDeaths) },
			{ name: '4s', kd: this.calculateKD(fourFourFinalKills, fourFourFinalDeaths) },
		].filter(({ kd }) => kd !== null);

		if (!kds.length) return `\`${playername}\` has no bed wars stats`;

		return `${playername}: ${kds.map(({ name, kd }) => `${name}: ${kd}`).join(', ')}`;
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		try {
			const uuid = args.length
				? await mojang.getUUID(args[0])
				: message.author.player?.minecraftUUID ?? await mojang.getUUID(message.author.ign);
			const { playername, stats: { Bedwars } } = await hypixel.player.uuid(uuid);

			return message.reply(this.generateReply(playername, Bedwars));
		} catch (error) {
			logger.error(`[FKDR]: ${error instanceof MojangAPIError
					? `${error}`
					: error.message
			}`);

			return message.reply(
				error instanceof MojangAPIError
					? `${error}`
					: error.message,
			);
		}
	}
};
