'use strict';
const { upperCaseFirstChar } = require('../util');
const { X_EMOJI } = require('../../constants/emojiCharacters');
const mojang = require('../../api/mojang');
const senither = require('../../api/senither');
const MojangAPIError = require('../../structures/errors/MojangAPIError');
const logger = require('../logger');


/**
 * weight command
 * @param {import('../../structures/extensions/Message')|import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
 * @param {string[]} args command arguments
 */
module.exports = async (message, args) => {
	try {
		const uuid = args.length
			? await mojang.getUUID(args[0])
			: message.author.player?.minecraftUUID ?? await mojang.getUUID(message.author.ign);
		const data = await senither.profiles.uuid(uuid, args.length < 2 ? 'weight' : null);
		const { username, name, weight, weight_overflow: overflow, skills: { apiEnabled } } = args.length < 2
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
};
