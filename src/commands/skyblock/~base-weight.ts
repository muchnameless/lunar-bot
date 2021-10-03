import { PROFILE_NAMES, X_EMOJI } from '../../constants';
import { hypixel } from '../../api/hypixel';
import { InteractionUtil } from '../../util';
import { autocorrect, getUuidAndIgn, logger, upperCaseFirstChar } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { Components } from '@zikeji/hypixel';
import type { SkyBlockProfile } from '../../api/hypixel';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { WeightData } from '../../functions';


export default class BaseWeightCommand extends DualCommand {
	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
	getWeight(skyblockMember: Components.Schemas.SkyBlockProfileMember): WeightData {
		throw new Error('no weight algorithm implemented');
	}

	/**
	 * rounds and toLocaleStrings a number
	 * @param number
	 */
	formatNumber(number: number) {
		return this.client.formatDecimalNumber(Math.floor(number * 100) / 100);
	}

	/**
	 * @param ctx
	 * @param ignOrUuid command arguments
	 * @param profileName
	 */
	async _generateReply(ctx: CommandInteraction | HypixelMessage, ignOrUuid?: string | null, profileName?: string | null) {
		try {
			const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
			const profiles = await hypixel.skyblock.profiles.uuid(uuid) as SkyBlockProfile[];

			if (!profiles?.length) return `${ign} has no SkyBlock profiles`;

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

			return `${ign} (${weightData.name}): ${this.formatNumber(weightData.totalWeight)} [${this.formatNumber(weightData.weight)} + ${this.formatNumber(weightData.overflow)}]${weightData.skillAPIEnabled ? '' : ` (${X_EMOJI} API disabled)`}`;
		} catch (error) {
			logger.error('[WEIGHT]', error);

			return `${error}`;
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		return InteractionUtil.reply(interaction, await this._generateReply(interaction, interaction.options.getString('ign'), interaction.options.getString('profile')));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelMessage<true>) {
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

		return hypixelMessage.reply(await this._generateReply(hypixelMessage, IGN, profileName));
	}
}
