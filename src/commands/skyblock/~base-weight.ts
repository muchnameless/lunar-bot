import { type Components } from '@zikeji/hypixel';
import { type ChatInputCommandInteraction } from 'discord.js';
import BaseSkyBlockCommand from './~base-skyblock-command.js';
import { getSkyBlockProfiles } from '#api';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { FindProfileStrategy, UnicodeEmoji } from '#constants';
import { formatDecimalNumber, formatPercent, getUuidAndIgn, type WeightData } from '#functions';

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
	 * @param profile
	 * @param uuid
	 */
	private _transformProfileToWeightData(
		profile: NonNullable<Components.Schemas.SkyBlockProfileCuteName>,
		uuid: string,
	) {
		return {
			profile,
			...this._getWeight(profile.members[uuid]!),
		};
	}

	/**
	 * @param ctx
	 * @param ignOrUuid command arguments
	 * @param profileName
	 * @param findProfileStrategy
	 */
	// @ts-expect-error override
	protected override async _fetchData(
		ctx: ChatInputCommandInteraction<'cachedOrDM'> | HypixelUserMessage,
		ignOrUuid: string | null,
		profileName: string | null,
		findProfileStrategy: FindProfileStrategy | null,
	) {
		// API requests
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const profiles = await getSkyBlockProfiles(uuid);

		if (!profiles?.length) throw `\`${ign}\` has no SkyBlock profiles`;

		return {
			ign,
			weightData: profileName
				? this._transformProfileToWeightData(this._findProfileByName(profiles, profileName, ign), uuid)
				: findProfileStrategy === FindProfileStrategy.LastActive
				? this._transformProfileToWeightData(profiles.find(({ selected }) => selected)!, uuid)
				: profiles
						.map((profile) => this._transformProfileToWeightData(profile, uuid))
						.sort(({ totalWeight: a }, { totalWeight: b }) => b - a)[0]!,
		};
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	// @ts-expect-error override
	protected override _generateReply({ ign, weightData }: Awaited<ReturnType<this['_fetchData']>>) {
		const { profile, totalWeight, overflow, skill, dungeons, slayer, skillAPIEnabled } = weightData;

		return {
			ign,
			profile,
			reply: `${this._formatNumber(totalWeight, totalWeight > 1_000 ? 2 : 1)} (${this._formatNumber(
				overflow,
				totalWeight > 1_000 ? 2 : 1,
			)} Overflow) | Skill: ${this._formatNumber(skill)} (${formatPercent(skill / totalWeight)})${
				skillAPIEnabled ? '' : ` ${UnicodeEmoji.X} API disabled`
			} | Dungeons: ${this._formatNumber(dungeons)} (${formatPercent(
				dungeons / totalWeight,
			)}) | Slayer: ${this._formatNumber(slayer)} (${formatPercent(slayer / totalWeight)}) | ${this.weightType}`,
		};
	}
}
