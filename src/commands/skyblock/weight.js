'use strict';

const { Constants } = require('discord.js');
const { upperCaseFirstChar, autocorrect } = require('../../functions/util');
const { getWeight } = require('../../functions/skyblock');
const { getUuidAndIgn } = require('../../functions/input');
const { X_EMOJI } = require('../../constants/emojiCharacters');
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
				}, {
					name: 'profile',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'skyblock profile name',
					required: false,
				}],
				defaultPermission: true,
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
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {string} ignOrUuid command arguments
	 * @param {string} [profileNameInput]
	 */
	async _run(ctx, ignOrUuid, profileNameInput) {
		try {
			const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
			const profiles = await hypixel.skyblock.profiles.uuid(uuid);

			if (!profiles.length) return `${ign} has no SkyBlock profiles`;

			const PROFILE_NAME = profileNameInput?.replace(/[^a-z]/gi, '');

			let weightData;

			if (!PROFILE_NAME) {
				weightData = profiles
					.map(({ cute_name: name, members }) => ({ name, ...getWeight(members[uuid]) }))
					.sort(({ totalWeight: aTotal }, { totalWeight: bTotal }) => aTotal - bTotal)
					.pop();
			} else {
				const { value: profile, similarity } = autocorrect(PROFILE_NAME, profiles, 'cute_name');

				if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) return `${ign} has no profile named '${upperCaseFirstChar(PROFILE_NAME)}'`;

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

		return interaction.reply(await this._run(interaction, interaction.options.getString('ign'), interaction.options.getString('profile')));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message
	 */
	async runInGame(message) {
		return message.reply(await this._run(message, ...message.commandData.args));
	}
};
