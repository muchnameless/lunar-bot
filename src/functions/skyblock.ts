import lilyweight from 'lilyweight';
import {
	DUNGEON_CAP,
	DUNGEON_CLASSES,
	DUNGEON_EXPONENTS,
	DUNGEON_TYPES,
	DUNGEON_TYPES_AND_CLASSES,
	DUNGEON_XP,
	DUNGEON_XP_TOTAL,
	LILY_SKILL_NAMES,
	LILY_SKILL_NAMES_API,
	RUNECRAFTING_XP,
	SKILL_CAP,
	SKILL_DIVIDER,
	SKILL_EXPONENTS,
	SKILL_XP,
	SKILL_XP_PAST_50,
	SKILL_XP_TOTAL,
	SKILLS,
	SLAYER_DIVIDER,
	SLAYER_MODIFIER,
	SLAYERS,
} from '../constants';
import type { Components } from '@zikeji/hypixel';
import type { ArrayElement } from '../types/util';
import type { DungeonTypes, SkillTypes } from '../constants';


/**
 * returns the true and progression level for the provided skill type
 * @param type the skill or dungeon type
 * @param xp
 * @param individualCap individual level cap for the player
 */
export function getSkillLevel(type: SkillTypes | DungeonTypes, xp = 0, individualCap: number | null = null) {
	let xpTable = DUNGEON_TYPES_AND_CLASSES.includes(type as any)
		? DUNGEON_XP
		: (type === 'runecrafting'
			? RUNECRAFTING_XP
			: SKILL_XP);
	let maxLevel = Math.max(...Object.keys(xpTable) as unknown as number[]);

	if (SKILL_CAP[type as keyof typeof SKILL_CAP] > maxLevel || individualCap) {
		xpTable = { ...SKILL_XP_PAST_50, ...xpTable };
		maxLevel = individualCap !== null
			? individualCap
			: Math.max(...Object.keys(xpTable) as unknown as number[]);
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

	if (trueLevel < maxLevel) {
		const nonFlooredLevel = trueLevel + (Math.floor(xp - xpTotal) / xpTable[trueLevel + 1 as keyof typeof xpTable]);

		return {
			trueLevel,
			progressLevel: Math.floor(nonFlooredLevel * 100) / 100,
			nonFlooredLevel,
		};
	}

	return {
		trueLevel,
		progressLevel: trueLevel,
		nonFlooredLevel: trueLevel,
	};
}


/**
 * Senither
 */

export type WeightData = ReturnType<typeof getSenitherWeight>;

/**
 * @param skyblockMember
 */
export function getSenitherWeight(skyblockMember: Components.Schemas.SkyBlockProfileMember) {
	let weight = 0;
	let overflow = 0;

	for (const skill of SKILLS) {
		const { skillWeight, skillOverflow } = getSenitherSkillWeight(skill, skyblockMember[`experience_skill_${skill}`] ?? 0);

		weight += skillWeight;
		overflow += skillOverflow;
	}

	for (const slayer of SLAYERS) {
		const { slayerWeight, slayerOverflow } = getSenitherSlayerWeight(slayer, skyblockMember.slayer_bosses?.[slayer]?.xp ?? 0);

		weight += slayerWeight;
		overflow += slayerOverflow;
	}

	for (const type of DUNGEON_TYPES) {
		const { dungeonWeight, dungeonOverflow } = getSenitherDungeonWeight(type, skyblockMember.dungeons?.dungeon_types?.[type]?.experience ?? 0);

		weight += dungeonWeight;
		overflow += dungeonOverflow;
	}

	for (const dungeonClass of DUNGEON_CLASSES) {
		const { dungeonWeight, dungeonOverflow } = getSenitherDungeonWeight(dungeonClass, skyblockMember.dungeons?.player_classes?.[dungeonClass]?.experience ?? 0);

		weight += dungeonWeight;
		overflow += dungeonOverflow;
	}

	return {
		skillAPIEnabled: Reflect.has(skyblockMember, 'experience_skill_alchemy'),
		weight,
		overflow,
		totalWeight: weight + overflow,
	};
}

/**
 * @param skillType
 * @param xp
 */
export function getSenitherSkillWeight(skillType: ArrayElement<typeof SKILLS>, xp = 0) {
	const { nonFlooredLevel: LEVEL } = getSkillLevel(skillType, xp);
	const MAX_XP = SKILL_XP_TOTAL[SKILL_CAP[skillType]] ?? Number.POSITIVE_INFINITY;

	return {
		skillWeight: ((LEVEL * 10) ** (0.5 + (SKILL_EXPONENTS[skillType] ?? Number.NEGATIVE_INFINITY) + (LEVEL / 100))) / 1_250,
		skillOverflow: xp > MAX_XP
			? ((xp - MAX_XP) / (SKILL_DIVIDER[skillType] ?? Number.POSITIVE_INFINITY)) ** 0.968
			: 0,
	};
}

/**
 * @param slayerType
 * @param xp
 */
export function getSenitherSlayerWeight(slayerType: ArrayElement<typeof SLAYERS>, xp = 0) {
	if (xp <= 1_000_000) {
		return {
			slayerWeight: xp === 0
				? 0
				: xp / (SLAYER_DIVIDER[slayerType] ?? Number.POSITIVE_INFINITY),
			slayerOverflow: 0,
		};
	}

	const DIVIDER = SLAYER_DIVIDER[slayerType] ?? Number.POSITIVE_INFINITY;

	let slayerWeight = 1_000_000 / DIVIDER;

	// calculate overflow
	let remaining = xp - 1_000_000;
	let modifier;

	const BASE_MODIFIER = modifier = SLAYER_MODIFIER[slayerType] ?? 0;

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
	const DUNGEON_WEIGHT = (LEVEL ** 4.5) * (DUNGEON_EXPONENTS[dungeonType] ?? 0);
	const MAX_XP = DUNGEON_XP_TOTAL[DUNGEON_CAP[dungeonType]] ?? Number.POSITIVE_INFINITY;

	return {
		dungeonWeight: DUNGEON_WEIGHT,
		dungeonOverflow: xp > MAX_XP
			? ((xp - MAX_XP) / (4 * MAX_XP / DUNGEON_WEIGHT)) ** 0.968
			: 0,
	};
}


/**
 * Lily
 */

export const { getWeightRaw: getLilyWeightRaw } = lilyweight();

/**
 * @param skyblockMember
 */
export function getLilyWeight(skyblockMember: Components.Schemas.SkyBlockProfileMember) {
	const SKILL_XP_LILY = LILY_SKILL_NAMES_API.map(skill => skyblockMember[skill as keyof typeof skyblockMember] ?? 0) as number[];
	const { total, skill: { overflow } } = getLilyWeightRaw(
		LILY_SKILL_NAMES.map((skill, index) => getSkillLevel(skill as SkillTypes, SKILL_XP_LILY[index], 60).trueLevel), // skill levels
		SKILL_XP_LILY, // skill xp
		skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions ?? {}, // catacombs completions
		skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions ?? {}, // master catacombs completions
		skyblockMember.dungeons?.dungeon_types?.catacombs?.experience ?? 0, // catacombs xp
		SLAYERS.map(slayer => skyblockMember.slayer_bosses?.[slayer]?.xp ?? 0), // slayer xp
	);

	return {
		skillAPIEnabled: Reflect.has(skyblockMember, 'experience_skill_alchemy'),
		weight: total - overflow,
		overflow: overflow as number,
		totalWeight: total as number,
	};
}
