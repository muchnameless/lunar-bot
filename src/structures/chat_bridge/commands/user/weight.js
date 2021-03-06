'use strict';
/* eslint-disable camelcase */

const fetch = require('node-fetch');
const { cleanFormattedNumber } = require('../../../../functions/util');
const { BASE_URL } = require('../../../../constants/weight');
const mojang = require('../../../../api/mojang');
const Command = require('../../../commands/Command');
const logger = require('../../../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'we' ],
			description: 'shows the player\'s total weight, weight and overflow for the profile with the most weight',
			args: true,
			usage: '[`IGN`]',
			cooldown: 1,
		});
	}

	/**
	 * inserts '-' into a uuid string
	 * @param {string} string
	 */
	formatUUID(string) {
		return string.replace(/([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})/i, (_, p1, p2, p3, p4, p5) => [ p1, p2, p3, p4, p5 ].join('-'));
	}

	/**
	 * rounds and toLocaleStrings a number
	 * @param {number} number
	 */
	formatNumber(number) {
		return cleanFormattedNumber(this.client.formatDecimalNumber(Math.floor(number * 100) / 100));
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) {
		try {
			const [ IGN ] = args;
			const uuid = this.formatUUID(await mojang.getUUID(IGN));
			const { code, reason, data } = await (await fetch(`${BASE_URL}/profiles/${uuid}/weight?key=${process.env.HYPIXEL_KEY_AUX_2}`)).json();

			if (reason) throw new Error(`[ERROR ${code}]: ${reason}`);

			return message.reply(`${data.username} (${data.name}): ${this.formatNumber(data.weight + data.weight_overflow)} [${this.formatNumber(data.weight)} + ${this.formatNumber(data.weight_overflow)}]`);
		} catch (error) {
			logger.error(error);
			return message.reply(`${error.name}: ${error.message}`);
		}
	}
};
