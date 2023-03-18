import type { Components } from '@zikeji/hypixel';
import { assertNever, getLilyWeight } from './index.js';
import {
	DUNGEON_XP_TOTAL,
	FindProfileStrategy,
	GAME_MODE_EMOJIS,
	LEVEL_CAP,
	RUNECRAFTING_XP_TOTAL,
	SKILL_XP_TOTAL,
	SLAYER_XP_TOTAL,
	SOCIAL_XP_TOTAL,
	type DungeonTypes,
	type SkillTypes,
} from '#constants';

/**
 * returns the true and progression level for the provided skill type
 *
 * @param type the skill or dungeon type
 * @param xp
 * @param individualCap individual level cap for the player
 */
export function getSkillLevel(type: DungeonTypes | SkillTypes, xp = 0, individualCap: number | null = null) {
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
 *
 * @param xp
 */
export const getSlayerLevel = (xp = 0) => SLAYER_XP_TOTAL.findLastIndex((requiredXp) => requiredXp <= xp);

/**
 * returns the main profile, determined by max senither weight
 *
 * @param profiles SkyBlock profiles
 * @param uuid minecraft uuid
 * @param findProfileStrategy
 */
export function findSkyBlockProfile(
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

		case FindProfileStrategy.LastActive:
			return profiles.find(({ selected }) => selected) ?? null;

		default:
			return null;
	}
}

/**
 * returns the profile name with a game_mode emoji if it exists
 *
 * @param profile
 */
export const formatSkyBlockProfileName = ({
	cute_name,
	game_mode,
}: NonNullable<Components.Schemas.SkyBlockProfileCuteName>) =>
	game_mode !== undefined && game_mode in GAME_MODE_EMOJIS
		? `${cute_name} ${GAME_MODE_EMOJIS[game_mode as keyof typeof GAME_MODE_EMOJIS]}`
		: cute_name;
