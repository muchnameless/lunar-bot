import { type Components } from '@zikeji/hypixel';
import { type ChatInputCommandInteraction } from 'discord.js';
import BaseSkyBlockCommand from './~base-skyblock-command.js';
import { getSkyBlockProfiles } from '#api';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { UnicodeEmoji } from '#constants';
import { escapeIgn, formatDecimalNumber, formatPercent, getUuidAndIgn, type WeightData } from '#functions';

export default class BaseWeightCommand extends BaseSkyBlockCommand {
	/**
	 * name of the weight algorithm
	 */
	protected readonly weightType: string = 'unknown';

	/**
	 * weight algorithm
	 */
	protected _getWeight: (skyblockMember: Components.Schemas.SkyBlockProfileMember) => WeightData = () => {
		throw new Error(`no '${this.weightType}' weight algorithm implemented`);
	};

	/**
	 * rounds and toLocaleStrings a number
	 *
	 * @param number
	 */
	private _formatNumber(number: number, decimals = 1) {
		return formatDecimalNumber(Math.trunc(number * 100) / 100, { decimals });
	}

	/**
	 * @param ctx
	 * @param ignOrUuid command arguments
	 * @param profileName
	 */
	// @ts-expect-error override
	protected override async _fetchData(
		ctx: ChatInputCommandInteraction<'cachedOrDM'> | HypixelUserMessage,
		ignOrUuid?: string | null,
		profileName?: string | null,
	) {
		// API requests
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const profiles = await getSkyBlockProfiles(uuid);

		if (!profiles?.length) throw `\`${ign}\` has no SkyBlock profiles`;

		// select profile
		let weightData: WeightData & { name: string };

		if (profileName) {
			const profile = this._findProfileByName(profiles, profileName, ign);

			weightData = {
				name: profile.cute_name,
				...this._getWeight(profile.members[uuid]!),
			};
		} else {
			[weightData] = profiles
				.map(({ cute_name: name, members }) => ({ name, ...this._getWeight(members[uuid]!) }))
				.sort(({ totalWeight: a }, { totalWeight: b }) => b - a) as [WeightData & { name: string }];
		}

		return { ign, weightData };
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	// @ts-expect-error override
	protected override _generateReply({ ign, weightData }: Awaited<ReturnType<this['_fetchData']>>) {
		const { name, totalWeight, overflow, skill, dungeons, slayer, skillAPIEnabled } = weightData;

		return `${escapeIgn(ign)} (${name}): ${this._formatNumber(
			totalWeight,
			totalWeight > 1_000 ? 2 : 1,
		)} (${this._formatNumber(overflow, totalWeight > 1_000 ? 2 : 1)} Overflow) | Skill: ${this._formatNumber(
			skill,
		)} (${formatPercent(skill / totalWeight)})${
			skillAPIEnabled ? '' : ` ${UnicodeEmoji.X} API disabled`
		} | Dungeons: ${this._formatNumber(dungeons)} (${formatPercent(
			dungeons / totalWeight,
		)}) | Slayer: ${this._formatNumber(slayer)} (${formatPercent(slayer / totalWeight)}) | ${this.weightType}`;
	}
}
