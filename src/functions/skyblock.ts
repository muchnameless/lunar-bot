import {
	DUNGEON_TYPES_AND_CLASSES,
	DUNGEON_XP,
	LEVEL_CAP,
	RUNECRAFTING_XP,
	SKILL_XP,
	SKILL_XP_PAST_50,
	SLAYER_XP,
} from '../constants';
import { getLilyWeight } from '.';
import type { Components } from '@zikeji/hypixel';
import type { DungeonTypes, SkillTypes } from '../constants';

// eslint-disable-next-line camelcase
export type SkyBlockProfile = Components.Schemas.SkyBlockProfileCuteName & { cute_name: string };

type SkyBlockProfiles = Components.Schemas.SkyBlockProfileCuteName[];

// used for getSkillLevel to determine the xpTable
const DUNGEON_TYPES_AND_CLASSES_SET = new Set(DUNGEON_TYPES_AND_CLASSES);

/**
 * returns the true and progression level for the provided skill type
 * @param type the skill or dungeon type
 * @param xp
 * @param individualCap individual level cap for the player
 */
export function getSkillLevel(type: SkillTypes | DungeonTypes, xp = 0, individualCap: number | null = null) {
	let xpTable = DUNGEON_TYPES_AND_CLASSES_SET.has(type as any)
		? DUNGEON_XP
		: type === 'runecrafting'
		? RUNECRAFTING_XP
		: SKILL_XP;
	let maxLevel = Math.max(...(Object.keys(xpTable) as unknown as number[]));

	if (LEVEL_CAP[type] > maxLevel || individualCap) {
		xpTable = { ...SKILL_XP_PAST_50, ...xpTable };
		maxLevel = individualCap !== null ? individualCap : Math.max(...(Object.keys(xpTable) as unknown as number[]));
	}

	let xpTotal = 0;
	let trueLevel = 0;

	for (let x = 1; x <= maxLevel; ++x) {
		xpTotal += xpTable[x as keyof typeof xpTable];

		if (xpTotal > xp) {
			xpTotal -= xpTable[x as keyof typeof xpTable];
			break;
		} else {
			trueLevel = x;
		}
	}

	if (trueLevel >= maxLevel) {
		return {
			trueLevel,
			progressLevel: trueLevel,
			nonFlooredLevel: trueLevel,
		};
	}

	const nonFlooredLevel = trueLevel + Math.floor(xp - xpTotal) / xpTable[(trueLevel + 1) as keyof typeof xpTable];

	return {
		trueLevel,
		progressLevel: Math.floor(nonFlooredLevel * 100) / 100,
		nonFlooredLevel,
	};
}

/**
 * returns the slayer level for the provided slayer xp
 * @param xp
 */
export function getSlayerLevel(xp = 0) {
	const MAX_LEVEL = Math.max(...(Object.keys(SLAYER_XP) as unknown as number[]));

	let level = 0;

	for (let x = 1; x <= MAX_LEVEL && SLAYER_XP[x as keyof typeof SLAYER_XP] <= xp; ++x) {
		level = x;
	}

	return level;
}

/**
 * returns the main profile, determined by max senither weight
 * @param profiles SkyBlock profiles
 * @param uuid minecraft uuid
 */
export function getMainProfile(profiles: SkyBlockProfiles | null, uuid: string) {
	if (!profiles?.length) return null;

	let mainProfile = null;
	let maxWeight = -1;

	for (const profile of profiles) {
		if (!profile) continue;

		const { totalWeight } = getLilyWeight(profile.members[uuid]);

		if (maxWeight > totalWeight) continue;

		mainProfile = profile;
		maxWeight = totalWeight;
	}

	return mainProfile;
}
