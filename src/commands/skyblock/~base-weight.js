// import { SlashCommandBuilder } from '@discordjs/builders';
import { upperCaseFirstChar, autocorrect } from '../../functions/util.js';
import { getUuidAndIgn } from '../../functions/input.js';
import { X_EMOJI } from '../../constants/emojiCharacters.js';
import { PROFILE_NAMES } from '../../constants/skyblock.js';
import { hypixel } from '../../api/hypixel.js';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
import { logger } from '../../functions/logger.js';


export default class BaseWeightCommand extends DualCommand {
	// eslint-disable-next-line class-methods-use-this
	getWeight() {
		throw new Error('no weight algorithm implemented');
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
	 * @param {import('discord.js').CommandInteraction | import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} ctx
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
					.map(({ cute_name: name, members }) => ({ name, ...this.getWeight(members[uuid]) }))
					.sort(({ totalWeight: aTotal }, { totalWeight: bTotal }) => bTotal - aTotal);
			} else {
				const profile = profiles.find(({ cute_name: name }) => name === profileName);

				if (!profile) return `${ign} has no profile named '${upperCaseFirstChar(profileName)}'`;

				weightData = {
					name: profile.cute_name,
					...this.getWeight(profile.members[uuid]),
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		InteractionUtil.deferReply(interaction);

		return await InteractionUtil.reply(interaction, await this._generateReply(interaction, interaction.options.getString('ign'), interaction.options.getString('profile')));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		const [ IGN, PROFILE_NAME_INPUT ] = hypixelMessage.commandData.args;

		let profileName = PROFILE_NAME_INPUT?.replace(/\W/g, '');

		if (profileName) {
			let similarity;

			({ value: profileName, similarity } = autocorrect(profileName, PROFILE_NAMES));

			if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) {
				try {
					await hypixelMessage.awaitConfirmation({
						question: `'${upperCaseFirstChar(PROFILE_NAME_INPUT)}' is not a valid SkyBlock profile name, did you mean '${profileName}'?`,
						timeoutSeconds: 30,
					});
				} catch (error) {
					logger.error(error);
					return;
				}
			}
		}

		return await hypixelMessage.reply(await this._generateReply(hypixelMessage, IGN, profileName));
	}
}
