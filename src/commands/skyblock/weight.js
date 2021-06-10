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
					description: 'IGN',
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
	 * @param {string} [profileName]
	 */
	async _run(ctx, ignOrUuid, profileName) {
		try {
			const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
			const profiles = await hypixel.skyblock.profiles.uuid(uuid);

			if (!profiles.length) return ctx.reply(`${ign} has no SkyBlock profiles`);

			let weightData;

			if (!profileName) {
				weightData = profiles
					.map(({ cute_name: name, members }) => ({ name, ...getWeight(members[uuid]) }))
					.sort(({ totalWeight: aTotal }, { totalWeight: bTotal }) => aTotal - bTotal)
					.pop();
			} else {
				const { value: profile, similarity } = autocorrect(profileName, profiles, 'cute_name');

				if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) return ctx.reply(`${ign} has no profile named '${upperCaseFirstChar(profileName)}'`);

				weightData = {
					name: profile.cute_name,
					...getWeight(profile.members[uuid]),
				};
			}

			return ctx.reply(
				`${ign} (${weightData.name}): ${this.formatNumber(weightData.totalWeight)} [${this.formatNumber(weightData.weight)} + ${this.formatNumber(weightData.overflow)}]${weightData.skillApiEnabled ? '' : ` (${X_EMOJI} API disabled)`}`,
			);
		} catch (error) {
			logger.error('[WEIGHT]', error);

			return ctx.reply(`${error}`);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		return this._run(interaction, interaction.options.get('ign')?.value, interaction.options.get('profile')?.value);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) {
		return this._run(message, ...args);
	}
};
