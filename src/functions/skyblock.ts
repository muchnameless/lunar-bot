import {
	DUNGEON_TYPES_AND_CLASSES_SET,
	DUNGEON_XP,
	FindProfileStrategy,
	LEVEL_CAP,
	RUNECRAFTING_XP,
	SKILL_XP,
	SKILL_XP_PAST_50,
	SLAYER_XP,
} from '../constants';
import { keys } from '../types/util';
import { getLilyWeight } from '.';
import type { Components } from '@zikeji/hypixel';
import type { DungeonTypes, SkillTypes } from '../constants';

export type SkyBlockProfile = Components.Schemas.SkyBlockProfileCuteName & { cute_name: string };

type SkyBlockProfiles = Components.Schemas.SkyBlockProfileCuteName[];

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
	let maxLevel = Math.max(...keys(xpTable));

	if (LEVEL_CAP[type] > maxLevel || individualCap) {
		xpTable = { ...SKILL_XP_PAST_50, ...xpTable };
		maxLevel = individualCap !== null ? individualCap : Math.max(...keys(xpTable));
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

	const nonFlooredLevel = trueLevel + Math.trunc(xp - xpTotal) / xpTable[(trueLevel + 1) as keyof typeof xpTable];

	return {
		trueLevel,
		progressLevel: Math.trunc(nonFlooredLevel * 100) / 100,
		nonFlooredLevel,
	};
}

/**
 * returns the slayer level for the provided slayer xp
 * @param xp
 */
export function getSlayerLevel(xp = 0) {
	const MAX_LEVEL = Math.max(...keys(SLAYER_XP));

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
 * @param findProfileStrategy
 */
export function findSkyblockProfile(
	profiles: SkyBlockProfiles | null,
	uuid: string,
	findProfileStrategy?: FindProfileStrategy | null,
) {
	if (!profiles?.length) return null;
	if (profiles.length === 1) return profiles[0];

	switch (findProfileStrategy ?? FindProfileStrategy.MaxWeight) {
		case FindProfileStrategy.MaxWeight: {
			let mainProfile = null;
			let maxWeight = -1;

			for (const profile of profiles) {
				if (!profile) continue;

				const { totalWeight } = getLilyWeight(profile.members[uuid]!);

				if (maxWeight > totalWeight) continue;

				mainProfile = profile;
				maxWeight = totalWeight;
			}

			return mainProfile;
		}

		case FindProfileStrategy.LastActive: {
			let mainProfile = null;
			let lastActive = -1;

			for (const profile of profiles) {
				if (!profile) continue;

				profile.members[uuid]!.last_save;

				if (lastActive > profile.members[uuid]!.last_save) continue;

				mainProfile = profile;
				lastActive = profile.members[uuid]!.last_save;
			}

			return mainProfile;
		}
	}
}
