'use strict';

const { upperCaseFirstChar } = require('../../functions/util');
const { getWeight } = require('../../functions/skyblock');
const { getUuidAndIgn } = require('../../functions/commands/input');
const { X_EMOJI } = require('../../constants/emojiCharacters');
const hypixel = require('../../api/hypixel');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class WeightCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'w' ],
			description: 'shows a player\'s total weight, weight and overflow',
			args: false,
			usage: '<`IGN`> <`profile` name>',
			cooldown: 1,
		});
	}

	/**
	 * rounds and toLocaleStrings a number
	 * @param {number} number
	 * @returns {string}
	 */
	formatNumber(number) {
		return this.client.formatDecimalNumber(Math.floor(number * 100) / 100);
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
			const profiles = await hypixel.skyblock.profiles.uuid(uuid);

			if (!profiles.length) return message.reply(`${ign} has no skyblock profiles`);

			let weightData;

			if (args.length < 2) {
				weightData = profiles
					.map(({ cute_name: name, members }) => ({ name, ...getWeight(members[uuid]) }))
					.sort(({ total: aTotal }, { total: bTotal }) => aTotal - bTotal)
					.pop();
			} else {
				const PROFILE_NAME = args[1].toLowerCase();
				const profile = profiles.find(({ cute_name: name }) => name.toLowerCase() === PROFILE_NAME);

				if (!profile) return message.reply(`${ign} has no profile named '${upperCaseFirstChar(PROFILE_NAME)}'`);

				weightData = {
					name: profile.cute_name,
					...getWeight(profile.members[uuid]),
				};
			}

			return message.reply(
				`${ign} (${weightData.name}): ${this.formatNumber(weightData.total)} [${this.formatNumber(weightData.weight)} + ${this.formatNumber(weightData.overflow)}]${weightData.skillApiEnabled ? '' : ` (${X_EMOJI} API disabled)`}`,
			);
		} catch (error) {
			logger.error(`[WEIGHT]: ${error}`);

			return message.reply(`${error}`);
		}
	}
};
