'use strict';

const fetch = require('node-fetch');
const { upperCaseFirstChar } = require('../../../../functions/util');
const { BASE_URL } = require('../../../../constants/weight');
const mojang = require('../../../../api/mojang');
const MojangAPIError = require('../../../errors/MojangAPIError');
const Command = require('../../../commands/Command');
const logger = require('../../../../functions/logger');


module.exports = class WeightCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'w', 'we' ],
			description: 'shows a player\'s total weight, weight and overflow',
			args: false,
			usage: '<\'IGN\'> <\'profile\' name>',
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
		return this.client.formatDecimalNumber(Math.floor(number * 100) / 100);
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args) {
		try {
			const uuid = args.length
				? await mojang.getUUID(args[0])
				: message.author.player?.minecraftUUID ?? await mojang.getUUID(message.author.ign);
			const { status, reason, data } = await (await fetch(`${BASE_URL}/profiles/${this.formatUUID(uuid)}${args.length < 2 ? '/weight' : ''}`, { headers: { 'Authorization': process.env.HYPIXEL_KEY_AUX_2 } })).json();

			if (reason) throw new Error(`[Error ${status}]: ${reason}`);

			const { username, name, weight, weight_overflow: overflow } = args.length < 2 ? data : data.find(x => x.name.toLowerCase() === args[1].toLowerCase()) ?? (() => { throw new Error(`unknown profile name '${upperCaseFirstChar(args[1].toLowerCase())}'`); })();

			return message.reply(`${username} (${name}): ${this.formatNumber(weight + overflow)} [${this.formatNumber(weight)} + ${this.formatNumber(overflow)}]`);
		} catch (error) {
			logger.error(`[WEIGHT]: ${error instanceof MojangAPIError
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
