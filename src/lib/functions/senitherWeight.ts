import type { ArrayElementType } from '@sapphire/utilities';
import type { Components } from '@zikeji/hypixel';
import { getSkillLevel } from './index.js';
import {
	DUNGEON_CLASSES,
	DUNGEON_EXPONENTS,
	DUNGEON_TYPES,
	DUNGEON_XP_TOTAL,
	LEVEL_CAP,
	SKILL_DIVIDER,
	SKILL_EXPONENTS,
	SKILL_XP_TOTAL,
	SKILLS,
	SLAYER_DIVIDER,
	SLAYER_MODIFIER,
	SLAYERS,
	type DungeonTypes,
} from '#constants';

export type WeightData = ReturnType<typeof getSenitherWeight>;

/**
 * @param skyblockMember
 */
export function getSenitherWeight(skyblockMember: Components.Schemas.SkyBlockProfileMember) {
	let weight = 0;
	let overflow = 0;

	let totalSkillWeight = 0;

	for (const skill of SKILLS) {
		const { skillWeight, skillOverflow } = getSenitherSkillWeight(
			skill,
			skyblockMember[`experience_skill_${skill}`] ?? 0,
		);

		totalSkillWeight += skillWeight + skillOverflow;
		weight += skillWeight;
		overflow += skillOverflow;
	}

	let totalSlayerWeight = 0;

	for (const slayer of SLAYERS) {
		const { slayerWeight, slayerOverflow } = getSenitherSlayerWeight(
			slayer,
			skyblockMember.slayer_bosses?.[slayer]?.xp ?? 0,
		);

		totalSlayerWeight += slayerWeight + slayerOverflow;
		weight += slayerWeight;
		overflow += slayerOverflow;
	}

	let totalDungeonWeight = 0;

	for (const type of DUNGEON_TYPES) {
		const { dungeonWeight, dungeonOverflow } = getSenitherDungeonWeight(
			type,
			skyblockMember.dungeons?.dungeon_types?.[type]?.experience ?? 0,
		);

		totalDungeonWeight += dungeonWeight + dungeonOverflow;
		weight += dungeonWeight;
		overflow += dungeonOverflow;
	}

	for (const dungeonClass of DUNGEON_CLASSES) {
		const { dungeonWeight, dungeonOverflow } = getSenitherDungeonWeight(
			dungeonClass,
			skyblockMember.dungeons?.player_classes?.[dungeonClass]?.experience ?? 0,
		);

		totalDungeonWeight += dungeonWeight + dungeonOverflow;
		weight += dungeonWeight;
		overflow += dungeonOverflow;
	}

	return {
		skillAPIEnabled: 'experience_skill_mining' in skyblockMember,
		skill: totalSkillWeight,
		slayer: totalSlayerWeight,
		dungeons: totalDungeonWeight,
		weight,
		overflow,
		totalWeight: weight + overflow,
	};
}

/**
 * @param skillType
 * @param xp
 */
export function getSenitherSkillWeight(skillType: ArrayElementType<typeof SKILLS>, xp = 0) {
	const { nonFlooredLevel: LEVEL } = getSkillLevel(skillType, xp);
	const MAX_XP = SKILL_XP_TOTAL[LEVEL_CAP[skillType]] ?? Number.POSITIVE_INFINITY;

	return {
		skillWeight: (LEVEL * 10) ** (0.5 + (SKILL_EXPONENTS[skillType] ?? Number.NEGATIVE_INFINITY) + LEVEL / 100) / 1_250,
		skillOverflow: xp > MAX_XP ? ((xp - MAX_XP) / (SKILL_DIVIDER[skillType] ?? Number.POSITIVE_INFINITY)) ** 0.968 : 0,
	};
}

/**
 * @param slayerType
 * @param xp
 */
export function getSenitherSlayerWeight(slayerType: ArrayElementType<typeof SLAYERS>, xp = 0) {
	if (xp <= 1_000_000) {
		return {
			slayerWeight: xp === 0 ? 0 : xp / (SLAYER_DIVIDER[slayerType] ?? Number.POSITIVE_INFINITY),
			slayerOverflow: 0,
		};
	}

	const DIVIDER = SLAYER_DIVIDER[slayerType] ?? Number.POSITIVE_INFINITY;

	let slayerWeight = 1_000_000 / DIVIDER;

	// calculate overflow
	const BASE_MODIFIER = SLAYER_MODIFIER[slayerType] ?? 0;

	let modifier = BASE_MODIFIER;
	let remaining = xp - 1_000_000;

	while (remaining > 0) {
		const LEFT = Math.min(remaining, 1_000_000);

		slayerWeight += (LEFT / (DIVIDER * (1.5 + modifier))) ** 0.942;
		modifier += BASE_MODIFIER;
		remaining -= LEFT;
	}

	return {
		slayerWeight,
		slayerOverflow: 0,
	};
}

/**
 * @param dungeonType
 * @param xp
 */
export function getSenitherDungeonWeight(dungeonType: DungeonTypes, xp = 0) {
	const { nonFlooredLevel: LEVEL } = getSkillLevel(dungeonType, xp);
	const DUNGEON_WEIGHT = LEVEL ** 4.5 * (DUNGEON_EXPONENTS[dungeonType] ?? 0);
	const MAX_XP = DUNGEON_XP_TOTAL[LEVEL_CAP[dungeonType]] ?? Number.POSITIVE_INFINITY;

	return {
		dungeonWeight: DUNGEON_WEIGHT,
		dungeonOverflow: xp > MAX_XP ? ((xp - MAX_XP) / ((4 * MAX_XP) / DUNGEON_WEIGHT)) ** 0.968 : 0,
	};
}
