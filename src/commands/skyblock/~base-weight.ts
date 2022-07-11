import { UnicodeEmoji } from '#constants';
import { hypixel } from '#api';
import { escapeIgn, formatDecimalNumber, formatPercent, getUuidAndIgn } from '#functions';
import BaseSkyBlockCommand from './~base-skyblock-command';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';
import type { Components } from '@zikeji/hypixel';
import type { SkyBlockProfile, WeightData } from '#functions';

export default class BaseWeightCommand extends BaseSkyBlockCommand {
	/**
	 * name of the weight algorithm
	 */
	weightType = 'unknown';
	/**
	 * weight algorithm
	 */
	protected getWeight: (skyblockMember: Components.Schemas.SkyBlockProfileMember) => WeightData = () => {
		throw new Error(`no '${this.weightType}' weight algorithm implemented`);
	};

	/**
	 * rounds and toLocaleStrings a number
	 * @param number
	 */
	// eslint-disable-next-line class-methods-use-this
	private formatNumber(number: number, decimals = 1) {
		return formatDecimalNumber(Math.trunc(number * 100) / 100, { decimals });
	}

	/**
	 * @param ctx
	 * @param ignOrUuid command arguments
	 * @param profileName
	 */
	// @ts-expect-error
	protected override async _fetchData(
		ctx: ChatInputCommandInteraction<'cachedOrDM'> | HypixelUserMessage,
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
				.map(({ cute_name: name, members }) => ({ name, ...this.getWeight(members[uuid]!) }))
				.sort(({ totalWeight: a }, { totalWeight: b }) => b - a) as [WeightData & { name: string }];
		} else {
			const profile = this._findProfileByName(profiles, profileName, ign);

			weightData = {
				name: profile.cute_name,
				...this.getWeight(profile.members[uuid]!),
			};
		}

		return { ign, weightData };
	}

	/**
	 * data -> reply
	 * @param data
	 */
	// @ts-expect-error
	protected override _generateReply({ ign, weightData }: Awaited<ReturnType<this['_fetchData']>>) {
		const { name, totalWeight, overflow, skill, dungeons, slayer, skillAPIEnabled } = weightData;

		return `${escapeIgn(ign)} (${name}): ${this.formatNumber(
			totalWeight,
			totalWeight > 1_000 ? 2 : 1,
		)} (${this.formatNumber(overflow, totalWeight > 1_000 ? 2 : 1)} Overflow) | Skill: ${this.formatNumber(
			skill,
		)} (${formatPercent(skill / totalWeight)})${
			skillAPIEnabled ? '' : ` ${UnicodeEmoji.X} API disabled`
		} | Dungeons: ${this.formatNumber(dungeons)} (${formatPercent(
			dungeons / totalWeight,
		)}) | Slayer: ${this.formatNumber(slayer)} (${formatPercent(slayer / totalWeight)}) | ${this.weightType}`;
	}
}
