import {
	DUNGEON_XP,
	FindProfileStrategy,
	LEVEL_CAP,
	RUNECRAFTING_XP,
	SKILL_XP,
	SKILL_XP_PAST_50,
	SLAYER_XP,
	SOCIAL_XP,
} from '../constants';
import { assertNever, getLilyWeight } from '.';
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
	let xpTable;

	switch (type) {
		case 'catacombs':
		case 'healer':
		case 'mage':
		case 'berserk':
		case 'archer':
		case 'tank':
			xpTable = DUNGEON_XP;
			break;

		case 'runecrafting':
			xpTable = RUNECRAFTING_XP;
			break;

		case 'social2':
			xpTable = SOCIAL_XP;
			break;

		case 'taming':
		case 'farming':
		case 'mining':
		case 'combat':
		case 'foraging':
		case 'fishing':
		case 'enchanting':
		case 'alchemy':
		case 'carpentry':
			xpTable = SKILL_XP;
			break;

		default:
			return assertNever(type);
	}

	let maxLevel = xpTable.length - 1;

	if (LEVEL_CAP[type] > maxLevel || individualCap) {
		xpTable = SKILL_XP_PAST_50;
		maxLevel = individualCap !== null ? individualCap : xpTable.length - 1;
	}

	let xpTotal = 0;
	let trueLevel = 0;

	for (let x = 1; x <= maxLevel; ++x) {
		xpTotal += xpTable[x]!;

		if (xpTotal > xp) {
			xpTotal -= xpTable[x]!;
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

	const nonFlooredLevel = trueLevel + Math.trunc(xp - xpTotal) / xpTable[trueLevel + 1]!;

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
	return SLAYER_XP.findLastIndex((requiredXp) => requiredXp <= xp);
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
