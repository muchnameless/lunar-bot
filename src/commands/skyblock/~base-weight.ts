import { PROFILE_NAMES, X_EMOJI } from '../../constants';
import { hypixel } from '../../api';
import { InteractionUtil } from '../../util';
import {
	autocorrect,
	escapeIgn,
	formatDecimalNumber,
	getUuidAndIgn,
	logger,
	seconds,
	upperCaseFirstChar,
} from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { Components } from '@zikeji/hypixel';
import type { SkyBlockProfile, WeightData } from '../../functions';

export default class BaseWeightCommand extends DualCommand {
	/**
	 * name of the weight algorithm
	 */
	weightType = 'unknown';
	/**
	 * weight algorithm
	 */
	getWeight: (skyblockMember: Components.Schemas.SkyBlockProfileMember) => WeightData = () => {
		throw new Error(`no '${this.weightType}' weight algorithm implemented`);
	};

	/**
	 * rounds and toLocaleStrings a number
	 * @param number
	 */
	// eslint-disable-next-line class-methods-use-this
	formatNumber(number: number, decimals = 1) {
		return formatDecimalNumber(Math.floor(number * 100) / 100, { decimals });
	}

	/**
	 *
	 * @param number
	 */
	// eslint-disable-next-line class-methods-use-this
	formatPercent(number: number) {
		return `${(100 * number).toFixed(1)}%`;
	}

	/**
	 * @param ctx
	 * @param ignOrUuid command arguments
	 * @param profileName
	 */
	async _generateReply(
		ctx: CommandInteraction | HypixelUserMessage,
		ignOrUuid?: string | null,
		profileName?: string | null,
	) {
		try {
			// API requests
			const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
			const profiles = (await hypixel.skyblock.profiles.uuid(uuid)) as SkyBlockProfile[];

			if (!profiles?.length) return `\`${ign}\` has no SkyBlock profiles`;

			// select profile
			let weightData: WeightData & { name: string };

			if (!profileName) {
				[weightData] = profiles
					.map(({ cute_name: name, members }) => ({ name, ...this.getWeight(members[uuid]) }))
					.sort(({ totalWeight: a }, { totalWeight: b }) => b - a);
			} else {
				const profile = profiles.find(({ cute_name: name }) => name === profileName);

				if (!profile) return `\`${ign}\` has no profile named \`${upperCaseFirstChar(profileName)}\``;

				weightData = {
					name: profile.cute_name,
					...this.getWeight(profile.members[uuid]),
				};
			}

			// generate reply
			const { name, totalWeight, overflow, skill, dungeons, slayer, skillAPIEnabled } = weightData;

			return `${escapeIgn(ign)} (${name}): ${this.formatNumber(
				totalWeight,
				totalWeight > 1_000 ? 2 : 1,
			)} (${this.formatNumber(overflow, totalWeight > 1_000 ? 2 : 1)} Overflow) | Skill: ${this.formatNumber(
				skill,
			)} (${this.formatPercent(skill / totalWeight)})${
				skillAPIEnabled ? '' : ` ${X_EMOJI} API disabled`
			} | Dungeons: ${this.formatNumber(dungeons)} (${this.formatPercent(
				dungeons / totalWeight,
			)}) | Slayer: ${this.formatNumber(slayer)} (${this.formatPercent(slayer / totalWeight)}) | ${this.weightType}`;
		} catch (error) {
			logger.error(error, '[WEIGHT]');

			return `${error}`;
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		return InteractionUtil.reply(
			interaction,
			await this._generateReply(
				interaction,
				interaction.options.getString('ign'),
				interaction.options.getString('profile'),
			),
		);
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelUserMessage) {
		const [IGN, PROFILE_NAME_INPUT] = hypixelMessage.commandData.args;

		let profileName = PROFILE_NAME_INPUT?.replace(/\W/g, '');

		if (profileName) {
			let similarity: number;

			({ value: profileName, similarity } = autocorrect(profileName, PROFILE_NAMES));

			if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) {
				try {
					await hypixelMessage.awaitConfirmation({
						question: `'${upperCaseFirstChar(
							PROFILE_NAME_INPUT,
						)}' is not a valid SkyBlock profile name, did you mean '${profileName}'?`,
						time: seconds(30),
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
