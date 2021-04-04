'use strict';

const { oneLine } = require('common-tags');
const { getBedwarsLevelInfo } = require('@zikeji/hypixel');
const { getUuidAndIgn } = require('../../functions/commands/input');
const hypixel = require('../../api/hypixel');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class FkdrCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'shows a player\'s BedWars stats',
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
		if (kills == null || deaths == null) return null;
		return this.client.formatDecimalNumber(Math.floor((kills / deaths) * 100) / 100);
	}

	/**
	 * @param {string} ign
	 * @param {import('@zikeji/hypixel').Components.Schemas.PlayerStatsBedwars} data
	 */
	generateReply(ign, data) {
		return oneLine`
			${ign}:
			level: ${this.client.formatNumber(getBedwarsLevelInfo(data?.Experience ?? data?.Experience_new ?? 0).level)},
			wins: ${data.wins_bedwars ?? 0},
			losses: ${data.losses_bedwars ?? 0},
			games played: ${data.games_played_bedwars ?? 0},
			final kills: ${data.final_kills_bedwars ?? 0},
			final deaths: ${data.final_deaths_bedwars ?? 0},
			overall fkdr: ${this.calculateKD(data.final_kills_bedwars, data.final_deaths_bedwars) ?? '-/-'},
			win streak: ${data.winstreak ?? 0}
		`;
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
			const { uuid, ign } = await getUuidAndIgn(message, args);
			const { stats: { Bedwars } = {} } = await hypixel.player.uuid(uuid);

			if (!Bedwars) return message.reply(`\`${ign}\` has no bed wars stats`);
			return message.reply(this.generateReply(ign, Bedwars));
		} catch (error) {
			logger.error(`[BW CMD]: ${error}`);

			return message.reply(`${error}`);
		}
	}
};
