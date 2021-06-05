'use strict';
const { dungeonClasses, dungeonTypes, dungeonXp, dungeonXpTotal, dungeonCap, runecraftingXp, skillXp, skillXpTotal, skillCap, skillXpPast50, skills, slayers } = require('../constants/skyblock');
const { SKILL_EXPONENTS, SKILL_DIVIDER, SLAYER_DIVIDER, SLAYER_MODIFIER, DUNGEON_EXPONENTS } = require('../constants/weight');
// const logger = require('./logger');


/**
 * returns the true and progression level for the provided skill type
 * @param {string} type the skill or dungeon type
 * @param {number} xp
 * @param {number} individualCap individual level cap for the player
 */
function getSkillLevel(type, xp = 0, individualCap = null) {
	let xpTable = [ ...dungeonClasses, ...dungeonTypes ].includes(type)
		? dungeonXp
		: type === 'runecrafting'
			? runecraftingXp
			: skillXp;
	let maxLevel = Math.max(...Object.keys(xpTable));

	if (skillCap[type] > maxLevel) {
		xpTable = { ...skillXpPast50, ...xpTable };
		maxLevel = individualCap != null
			? individualCap
			: Math.max(...Object.keys(xpTable));
	}

	let xpTotal = 0;
	let trueLevel = 0;

	for (let x = 1; x <= maxLevel; ++x) {
		xpTotal += xpTable[x];

		if (xpTotal > xp) {
			xpTotal -= xpTable[x];
			break;
		} else {
			trueLevel = x;
		}
	}

	if (trueLevel < maxLevel) {
		const nonFlooredLevel = trueLevel + (Math.floor(xp - xpTotal) / xpTable[trueLevel + 1]);

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
 * @param {import('@zikeji/hypixel').Components.Schemas.SkyBlockProfileMember} skyblockMember
 */
function getWeight(skyblockMember) {
	let weight = 0;
	let overflow = 0;

	for (const skill of skills) {
		const { skillWeight, skillOverflow } = getSkillWeight(skill, skyblockMember[`experience_skill_${skill}`] ?? 0);

		weight += skillWeight;
		overflow += skillOverflow;
	}

	for (const slayer of slayers) {
		const { slayerWeight, slayerOverflow } = getSlayerWeight(slayer, skyblockMember.slayer_bosses?.[slayer]?.xp ?? 0);

		weight += slayerWeight;
		overflow += slayerOverflow;
	}

	for (const type of dungeonTypes) {
		const { dungeonWeight, dungeonOverflow } = getDungeonWeight(type, skyblockMember.dungeons?.dungeon_types?.[type]?.experience ?? 0);

		weight += dungeonWeight;
		overflow += dungeonOverflow;
	}

	for (const dungeonClass of dungeonClasses) {
		const { dungeonWeight, dungeonOverflow } = getDungeonWeight(dungeonClass, skyblockMember.dungeons?.player_classes?.[dungeonClass]?.experience ?? 0);

		weight += dungeonWeight;
		overflow += dungeonOverflow;
	}

	return {
		skillApiEnabled: Reflect.has(skyblockMember, 'experience_skill_alchemy'),
		weight,
		overflow,
		totalWeight: weight + overflow,
	};
}

/**
 * @param {string} skillType
 * @param {number} xp
 */
function getSkillWeight(skillType, xp = 0) {
	const { nonFlooredLevel: LEVEL } = getSkillLevel(skillType, xp);
	const MAX_XP = skillXpTotal[skillCap[skillType]] ?? Infinity;

	return {
		skillWeight: ((LEVEL * 10) ** (0.5 + (SKILL_EXPONENTS[skillType] ?? -Infinity) + (LEVEL / 100))) / 1250,
		skillOverflow: xp > MAX_XP
			? ((xp - MAX_XP) / (SKILL_DIVIDER[skillType] ?? Infinity)) ** 0.968
			: 0,
	};
}

/**
 * @param {string} slayerType
 * @param {number} xp
 */
function getSlayerWeight(slayerType, xp = 0) {
	if (xp <= 1_000_000) {
		return {
			slayerWeight: xp === 0
				? 0
				: xp / (SLAYER_DIVIDER[slayerType] ?? Infinity),
			slayerOverflow: 0,
		};
	}

	const DIVIDER = SLAYER_DIVIDER[slayerType] ?? Infinity;

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
 * @param {string} dungeonType
 * @param {number} xp
 */
function getDungeonWeight(dungeonType, xp = 0) {
	const { nonFlooredLevel: LEVEL } = getSkillLevel(dungeonType, xp);
	const DUNGEON_WEIGHT = (LEVEL ** 4.5) * (DUNGEON_EXPONENTS[dungeonType] ?? 0);
	const MAX_XP = dungeonXpTotal[dungeonCap[dungeonType]] ?? Infinity;

	return {
		dungeonWeight: DUNGEON_WEIGHT,
		dungeonOverflow: xp > MAX_XP
			? ((xp - MAX_XP) / (4 * MAX_XP / DUNGEON_WEIGHT)) ** 0.968
			: 0,
	};
}


module.exports = {
	getSkillLevel,
	getWeight,
	getSkillWeight,
	getSlayerWeight,
	getDungeonWeight,
};
