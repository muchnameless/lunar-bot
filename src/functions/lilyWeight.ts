import LilyWeight from 'lilyweight';
import {
	LILY_SKILL_NAMES,
	LILY_SKILL_NAMES_API,
	SLAYERS,
} from '../constants';
import { getSkillLevel } from '.';
import type { Components } from '@zikeji/hypixel';

export const { getWeightRaw: getLilyWeightRaw } = LilyWeight;

/**
 * @param skyblockMember
 */
export function getLilyWeight(skyblockMember: Components.Schemas.SkyBlockProfileMember) {
	const SKILL_XP_LILY = LILY_SKILL_NAMES_API.map(skill => skyblockMember[skill as keyof typeof skyblockMember] as number ?? 0);
	const { total, skill: { overflow } } = getLilyWeightRaw(
		LILY_SKILL_NAMES.map((skill, index) => getSkillLevel(skill, SKILL_XP_LILY[index], 60).trueLevel), // skill levels
		SKILL_XP_LILY, // skill xp
		skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions ?? {}, // catacombs completions
		skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions ?? {}, // master catacombs completions
		skyblockMember.dungeons?.dungeon_types?.catacombs?.experience ?? 0, // catacombs xp
		SLAYERS.map(slayer => skyblockMember.slayer_bosses?.[slayer]?.xp ?? 0), // slayer xp
	);

	return {
		skillAPIEnabled: Reflect.has(skyblockMember, 'experience_skill_alchemy'),
		weight: total - overflow,
		overflow,
		totalWeight: total,
	};
}
