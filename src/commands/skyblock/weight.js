'use strict';

const { Constants } = require('discord.js');
const { upperCaseFirstChar, autocorrect } = require('../../functions/util');
const { getWeight } = require('../../functions/skyblock');
const { getUuidAndIgn } = require('../../functions/input');
const { X_EMOJI } = require('../../constants/emojiCharacters');
const { PROFILE_NAMES } = require('../../constants/skyblock');
const hypixel = require('../../api/hypixel');
const DualCommand = require('../../structures/commands/DualCommand');
const logger = require('../../functions/logger');


module.exports = class WeightCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s total weight, weight and overflow',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | UUID',
					required: false,
				}, DualCommand.SKYBLOCK_PROFILE_OPTION ],
				cooldown: 1,
			},
			{
				aliases: [ 'w' ],
				args: false,
				usage: '<`IGN`> <`profile` name>',
			},
		);
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
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {string} ignOrUuid command arguments
	 * @param {string} [profileName]
	 */
	async _generateReply(ctx, ignOrUuid, profileName) {
		try {
			const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
			const profiles = await hypixel.skyblock.profiles.uuid(uuid);

			if (!profiles.length) return `${ign} has no SkyBlock profiles`;

			let weightData;

			if (!profileName) {
				[ weightData ] = profiles
					.map(({ cute_name: name, members }) => ({ name, ...getWeight(members[uuid]) }))
					.sort(({ totalWeight: aTotal }, { totalWeight: bTotal }) => bTotal - aTotal);
			} else {
				const profile = profiles.find(({ cute_name: name }) => name === profileName);

				if (!profile) return `${ign} has no profile named '${upperCaseFirstChar(profileName)}'`;

				weightData = {
					name: profile.cute_name,
					...getWeight(profile.members[uuid]),
				};
			}

			return `${ign} (${weightData.name}): ${this.formatNumber(weightData.totalWeight)} [${this.formatNumber(weightData.weight)} + ${this.formatNumber(weightData.overflow)}]${weightData.skillApiEnabled ? '' : ` (${X_EMOJI} API disabled)`}`;
		} catch (error) {
			logger.error('[WEIGHT]', error);

			return `${error}`;
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer();

		return interaction.reply(await this._generateReply(interaction, interaction.options.getString('ign'), interaction.options.getString('profile')));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message
	 */
	async runInGame(message) {
		const [ IGN, PROFILE_NAME_INPUT ] = message.commandData.args;

		let profileName = PROFILE_NAME_INPUT?.replace(/\W/g, '');

		if (profileName) {
			let similarity;

			({ value: profileName, similarity } = autocorrect(profileName, PROFILE_NAMES));

			if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) {
				try {
					await message.awaitConfirmation({
						question: `'${upperCaseFirstChar(PROFILE_NAME_INPUT)}' is not a valid SkyBlock profile name, did you mean '${profileName}'?`,
						timeoutSeconds: 30,
					});
				} catch (error) {
					logger.error(error);
					return;
				}
			}
		}

		return message.reply(await this._generateReply(message, IGN, profileName));
	}
};
