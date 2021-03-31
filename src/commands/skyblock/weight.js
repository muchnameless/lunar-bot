'use strict';

const { upperCaseFirstChar } = require('../../functions/util');
const { X_EMOJI } = require('../../constants/emojiCharacters');
const mojang = require('../../api/mojang');
const senither = require('../../api/senither');
const MojangAPIError = require('../../structures/errors/MojangAPIError');
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
			const data = await senither.profiles.uuid(uuid, args.length < 2 ? 'weight' : null);
			const { username, name, weight, weight_overflow: overflow, skills: { apiEnabled = false } = {} } = args.length < 2
				? data
				: (data.find(({ name: profileName }) => profileName.toLowerCase() === args[1].toLowerCase()) ?? (() => { throw new Error(`unknown profile name '${upperCaseFirstChar(args[1].toLowerCase())}'`); })());

			/**
			 * rounds and toLocaleStrings a number
			 * @param {number} number
			 * @returns {string}
			 */
			const formatNumber = number => message.client.formatDecimalNumber(Math.floor(number * 100) / 100);

			return message.reply(`${username} (${name}): ${formatNumber(weight + overflow)} [${formatNumber(weight)} + ${formatNumber(overflow)}]${apiEnabled ? '' : ` (${X_EMOJI} API disabled)`}`);
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
