import LilyWeight from 'lilyweight';
import { LILY_SKILL_NAMES, LILY_SKILL_NAMES_API, SLAYERS } from '#constants';
import { getSkillLevel } from '.';
import type { Components } from '@zikeji/hypixel';
import type { WeightData } from '.';

export const { getWeightRaw: getLilyWeightRaw } = LilyWeight;

/**
 * @param skyblockMember
 */
export function getLilyWeight(skyblockMember: Components.Schemas.SkyBlockProfileMember): WeightData {
	const SKILL_XP_LILY = LILY_SKILL_NAMES_API.map((skill) => skyblockMember[skill] ?? 0);
	const {
		total,
		skill: { base: skill, overflow },
		slayer,
		catacombs,
	} = getLilyWeightRaw(
		LILY_SKILL_NAMES.map((_skill, index) => getSkillLevel(_skill, SKILL_XP_LILY[index], 60).trueLevel), // skill levels
		SKILL_XP_LILY, // skill xp
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		(skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions as Parameters<typeof getLilyWeightRaw>[2]) ??
			{}, // catacombs completions
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		(skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions as Parameters<
			typeof getLilyWeightRaw
		>[3]) ?? {}, // master catacombs completions
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		skyblockMember.dungeons?.dungeon_types?.catacombs?.experience ?? 0, // catacombs xp
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		SLAYERS.map((_slayer) => skyblockMember.slayer_bosses?.[_slayer]?.xp ?? 0), // slayer xp
	);

	return {
		skillAPIEnabled: Reflect.has(skyblockMember, 'experience_skill_mining'),
		skill,
		slayer,
		dungeons: catacombs.experience + catacombs.completion.base + catacombs.completion.master,
		weight: total - overflow,
		overflow,
		totalWeight: total,
	};
}
