import { X_EMOJI } from '../../constants';
import { hypixel } from '../../api';
import { escapeIgn, formatDecimalNumber, getUuidAndIgn, upperCaseFirstChar } from '../../functions';
import BaseSkyBlockCommand from './~base-skyblock-command';
import type { CommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { Components } from '@zikeji/hypixel';
import type { SkyBlockProfile, WeightData } from '../../functions';

export default class BaseWeightCommand extends BaseSkyBlockCommand {
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
		if (Number.isNaN(number)) return '0%';
		return `${(100 * number).toFixed(1)}%`;
	}

	/**
	 * @param ctx
	 * @param ignOrUuid command arguments
	 * @param profileName
	 */
	// @ts-expect-error
	override async _fetchData(
		ctx: CommandInteraction | HypixelUserMessage,
		ignOrUuid?: string | null,
		profileName?: string | null,
	) {
		// API requests
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const profiles = (await hypixel.skyblock.profiles.uuid(uuid)) as SkyBlockProfile[];

		if (!profiles?.length) throw `\`${ign}\` has no SkyBlock profiles`;

		// select profile
		let weightData: WeightData & { name: string };

		if (!profileName) {
			[weightData] = profiles
				.map(({ cute_name: name, members }) => ({ name, ...this.getWeight(members[uuid]) }))
				.sort(({ totalWeight: a }, { totalWeight: b }) => b - a);
		} else {
			const profile = profiles.find(({ cute_name: name }) => name === profileName);

			if (!profile) throw `\`${ign}\` has no profile named \`${upperCaseFirstChar(profileName)}\``;

			weightData = {
				name: profile.cute_name,
				...this.getWeight(profile.members[uuid]),
			};
		}

		return { ign, weightData };
	}

	/**
	 * data -> reply
	 * @param data
	 */
	// @ts-expect-error
	override _generateReply({ ign, weightData }: Awaited<ReturnType<this['_fetchData']>>) {
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
	}
}
