import {
	DUNGEON_XP_TOTAL,
	FindProfileStrategy,
	LEVEL_CAP,
	RUNECRAFTING_XP_TOTAL,
	SKILL_XP_TOTAL,
	SLAYER_XP_TOTAL,
	SOCIAL_XP_TOTAL,
} from '#constants';
import { assertNever, getLilyWeight } from '.';
import type { Components } from '@zikeji/hypixel';
import type { DungeonTypes, SkillTypes } from '#constants';

/**
 * returns the true and progression level for the provided skill type
 * @param type the skill or dungeon type
 * @param xp
 * @param individualCap individual level cap for the player
 */
export function getSkillLevel(type: SkillTypes | DungeonTypes, xp = 0, individualCap: number | null = null) {
	let totalXp: Readonly<number[]>;

	switch (type) {
		case 'catacombs':
		case 'healer':
		case 'mage':
		case 'berserk':
		case 'archer':
		case 'tank':
			totalXp = DUNGEON_XP_TOTAL;
			break;

		case 'runecrafting':
			totalXp = RUNECRAFTING_XP_TOTAL;
			break;

		case 'social2':
			totalXp = SOCIAL_XP_TOTAL;
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
			totalXp = SKILL_XP_TOTAL;
			break;

		default:
			return assertNever(type);
	}

	const MAX_LEVEL = individualCap ?? LEVEL_CAP[type];
	const TRUE_LEVEL = totalXp.findLastIndex((requiredXp, level) => requiredXp <= xp && level <= MAX_LEVEL);

	if (TRUE_LEVEL >= MAX_LEVEL) {
		return {
			trueLevel: TRUE_LEVEL,
			progressLevel: TRUE_LEVEL,
			nonFlooredLevel: TRUE_LEVEL,
		};
	}

	const PROGRESS_LEVEL = TRUE_LEVEL + (xp - totalXp[TRUE_LEVEL]!) / (totalXp[TRUE_LEVEL + 1]! - totalXp[TRUE_LEVEL]!);

	return {
		trueLevel: TRUE_LEVEL,
		progressLevel: Math.trunc(PROGRESS_LEVEL * 100) / 100,
		nonFlooredLevel: PROGRESS_LEVEL,
	};
}

/**
 * returns the slayer level for the provided slayer xp
 * @param xp
 */
export function getSlayerLevel(xp = 0) {
	return SLAYER_XP_TOTAL.findLastIndex((requiredXp) => requiredXp <= xp);
}

/**
 * returns the main profile, determined by max senither weight
 * @param profiles SkyBlock profiles
 * @param uuid minecraft uuid
 * @param findProfileStrategy
 */
export function findSkyblockProfile(
	profiles: NonNullable<Components.Schemas.SkyBlockProfileCuteName>[] | null,
	uuid: string,
	findProfileStrategy?: FindProfileStrategy | null,
): Components.Schemas.SkyBlockProfileCuteName {
	if (!profiles?.length) return null;
	if (profiles.length === 1) return profiles[0]!;

	switch (findProfileStrategy ?? FindProfileStrategy.MaxWeight) {
		case FindProfileStrategy.MaxWeight: {
			let mainProfile: Components.Schemas.SkyBlockProfileCuteName = null;
			let maxWeight = -1;

			for (const profile of profiles) {
				const { totalWeight } = getLilyWeight(profile.members[uuid]!);

				if (maxWeight > totalWeight) continue;

				mainProfile = profile;
				maxWeight = totalWeight;
			}

			return mainProfile;
		}

		case FindProfileStrategy.LastActive: {
			let mainProfile: Components.Schemas.SkyBlockProfileCuteName = null;
			let lastActive = -1;

			for (const profile of profiles) {
				profile.members[uuid]!.last_save;

				if (lastActive > profile.members[uuid]!.last_save) continue;

				mainProfile = profile;
				lastActive = profile.members[uuid]!.last_save;
			}

			return mainProfile;
		}
	}
}
