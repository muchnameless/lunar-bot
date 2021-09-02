import lilyweight from 'lilyweight';
import {
	DUNGEON_CAP,
	DUNGEON_EXPONENTS,
	DUNGEON_TYPES_AND_CLASSES,
	DUNGEON_XP,
	DUNGEON_XP_TOTAL,
	RUNECRAFTING_XP,
	SKILL_ACHIEVEMENTS,
	SKILL_CAP,
	SKILL_DIVIDER,
	SKILL_EXPONENTS,
	SKILL_XP,
	SKILL_XP_PAST_50,
	SKILL_XP_TOTAL,
	SKILLS,
	SLAYER_DIVIDER,
	SLAYER_MODIFIER,
	SLAYER_XP,
	SLAYERS,
} from '../constants/index.js';
import { hypixel } from '../api/hypixel.js';


/**
 * @typedef {ReturnType<transformAPIData>} skyBlockData
 */

/**
 * @param {import('@zikeji/hypixel').Components.Schemas.SkyBlockProfileMember} [skyblockMember]
 */
export function transformAPIData(skyblockMember = {}) {
	return {
		/**
		 * skills
		 */
		skillXp: {
			// sorted as expected by getLilyWeightRaw
			enchanting: skyblockMember.experience_skill_enchanting ?? 0,
			taming: skyblockMember.experience_skill_taming ?? 0,
			alchemy: skyblockMember.experience_skill_alchemy ?? 0,
			mining: skyblockMember.experience_skill_mining ?? 0,
			farming: skyblockMember.experience_skill_farming ?? 0,
			foraging: skyblockMember.experience_skill_foraging ?? 0,
			combat: skyblockMember.experience_skill_combat ?? 0,
			fishing: skyblockMember.experience_skill_fishing ?? 0,

			// cosmetic skills
			carpentry: skyblockMember.experience_skill_carpentry ?? 0,
			runecrafting: skyblockMember.experience_skill_runecrafting ?? 0,
		},
		skillApiEnabled: Reflect.has(skyblockMember, 'experience_skill_mining'),
		farmingLevelCap: 50 + (skyblockMember.jacob2?.perks?.farming_level_cap ?? 0),

		/**
		 * slayers
		 */
		slayerXp: {
			zombie: skyblockMember.slayer_bosses?.zombie?.xp ?? 0,
			wolf: skyblockMember.slayer_bosses?.wolf?.xp ?? 0,
			spider: skyblockMember.slayer_bosses?.spider?.xp ?? 0,
			enderman: skyblockMember.slayer_bosses?.enderman?.xp ?? 0,
		},

		/**
		 * dungeons
		 */
		dungeonXp: {
			// types
			catacombs: skyblockMember.dungeons?.dungeon_types?.catacombs?.experience ?? 0,

			// classes
			archer: skyblockMember.dungeons?.player_classes?.archer?.experience ?? 0,
			berserk: skyblockMember.dungeons?.player_classes?.berserk?.experience ?? 0,
			healer: skyblockMember.dungeons?.player_classes?.healer?.experience ?? 0,
			mage: skyblockMember.dungeons?.player_classes?.mage?.experience ?? 0,
			tank: skyblockMember.dungeons?.player_classes?.tank?.experience ?? 0,
		},
		dungeonCompletions: {
			normal: {
				1: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[1] ?? 0,
				2: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[2] ?? 0,
				3: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[3] ?? 0,
				4: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[4] ?? 0,
				5: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[5] ?? 0,
				6: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[6] ?? 0,
				7: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[7] ?? 0,
				8: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[8] ?? 0,
				9: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[9] ?? 0,
				10: skyblockMember.dungeons?.dungeon_types?.catacombs?.tier_completions?.[10] ?? 0,
			},
			master: {
				1: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[1] ?? 0,
				2: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[2] ?? 0,
				3: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[3] ?? 0,
				4: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[4] ?? 0,
				5: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[5] ?? 0,
				6: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[6] ?? 0,
				7: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[7] ?? 0,
				8: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[8] ?? 0,
				9: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[9] ?? 0,
				10: skyblockMember.dungeons?.dungeon_types?.master_catacombs?.tier_completions?.[10] ?? 0,
			},
		},
	};
}

/**
 * adds skill xp calculated from achievements
 * @param {skyBlockData} skyBlockData
 * @param {string} minecraftUuid
 */
export async function addAchievementsData(skyBlockData, minecraftUuid) {
	const { achievements } = await hypixel.player.uuid(minecraftUuid);

	for (const skill of SKILLS) skyBlockData.skillXp[skill] = SKILL_XP_TOTAL[achievements?.[SKILL_ACHIEVEMENTS[skill]] ?? 0] ?? 0;
}

/**
 * returns the true and progression level for the provided skill type
 * @param {string} type the skill or dungeon type
 * @param {skyBlockData} skyBlockData
 * @param {number} [levelCap] (individual) level cap for the player
 */
export function getSkillLevel(type, skyBlockData, levelCap = type === 'farming' ? skyBlockData.farmingLevelCap : SKILL_CAP[type]) {
	let xp;
	let xpTable;

	if (SKILLS.includes(type) || type === 'carpentry') {
		xp = skyBlockData.skillXp[type];
		xpTable = levelCap > 50
			? { ...SKILL_XP_PAST_50, ...SKILL_XP }
			: SKILL_XP;
	} else if (type === 'runecrafting') {
		xp = skyBlockData.skillXp[type];
		xpTable = RUNECRAFTING_XP;
	} else if (DUNGEON_TYPES_AND_CLASSES.includes(type)) {
		xp = skyBlockData.dungeonXp[type];
		xpTable = DUNGEON_XP;
	} else {
		throw new Error(`[GET SKILL LEVEL]: unknown type '${type}'`);
	}

	const MAX_LEVEL = Math.max(...Object.keys(xpTable));

	let xpTotal = 0;
	let trueLevel = 0;
	for (let x = 1; x <= MAX_LEVEL; ++x) {
		xpTotal += xpTable[x];

		if (xpTotal > xp) {
			xpTotal -= xpTable[x];
			break;
		} else {
			trueLevel = x;
		}
	}

	if (trueLevel < MAX_LEVEL) {
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
 * returns the slayer level for the provided slayer type
 * @param {string} type the slayer type
 * @param {skyBlockData} skyBlockData
 */
export function getSlayerLevel(type, skyBlockData) {
	const XP = skyBlockData.slayerXp[type];
	const MAX_LEVEL = Math.max(...Object.keys(SLAYER_XP));

	let level = 0;

	for (let x = 1; x <= MAX_LEVEL && SLAYER_XP[x] <= XP; ++x) {
		level = x;
	}

	return level;
}

/**
 * returns the total slayer xp
 * @param {skyBlockData} skyBlockData
 */
export function getTotalSlayerXp(skyBlockData) {
	return Object.values(skyBlockData.slayerXp).reduce((acc, xp) => acc + xp, 0);
}

/**
 * Senither
 */

/**
 * @param {skyBlockData} skyBlockData
 */
export function getSenitherWeight(skyBlockData) {
	let weight = 0;
	let overflow = 0;

	for (const skill of SKILLS) {
		const { skillWeight, skillOverflow } = getSenitherSkillWeight(skill, skyBlockData);

		weight += skillWeight;
		overflow += skillOverflow;
	}

	for (const slayer of SLAYERS) {
		const { slayerWeight, slayerOverflow } = getSenitherSlayerWeight(slayer, skyBlockData);

		weight += slayerWeight;
		overflow += slayerOverflow;
	}

	for (const type of DUNGEON_TYPES_AND_CLASSES) {
		const { dungeonWeight, dungeonOverflow } = getSenitherDungeonWeight(type, skyBlockData);

		weight += dungeonWeight;
		overflow += dungeonOverflow;
	}

	return {
		skillApiEnabled: skyBlockData.skillApiEnabled,
		weight,
		overflow,
		totalWeight: weight + overflow,
	};
}

/**
 * @param {string} skillType
 * @param {skyBlockData} skyBlockData
 */
export function getSenitherSkillWeight(skillType, skyBlockData) {
	const XP = skyBlockData.skillXp[skillType];
	const { nonFlooredLevel: LEVEL } = getSkillLevel(skillType, skyBlockData, SKILL_CAP[skillType]);
	const MAX_XP = SKILL_XP_TOTAL[SKILL_CAP[skillType]] ?? Infinity;

	return {
		skillWeight: ((LEVEL * 10) ** (0.5 + (SKILL_EXPONENTS[skillType] ?? -Infinity) + (LEVEL / 100))) / 1250,
		skillOverflow: XP > MAX_XP
			? ((XP - MAX_XP) / (SKILL_DIVIDER[skillType] ?? Infinity)) ** 0.968
			: 0,
	};
}

/**
 * @param {string} slayerType
 * @param {skyBlockData} skyBlockData
 */
export function getSenitherSlayerWeight(slayerType, skyBlockData) {
	const XP = skyBlockData.slayerXp[slayerType];

	if (XP <= 1_000_000) {
		return {
			slayerWeight: XP === 0
				? 0
				: XP / (SLAYER_DIVIDER[slayerType] ?? Infinity),
			slayerOverflow: 0,
		};
	}

	const DIVIDER = SLAYER_DIVIDER[slayerType] ?? Infinity;

	let slayerWeight = 1_000_000 / DIVIDER;

	// calculate overflow
	let remaining = XP - 1_000_000;
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
 * @param {skyBlockData} skyBlockData
 */
export function getSenitherDungeonWeight(dungeonType, skyBlockData) {
	const XP = skyBlockData.dungeonXp[dungeonType];
	const { nonFlooredLevel: LEVEL } = getSkillLevel(dungeonType, skyBlockData);
	const DUNGEON_WEIGHT = (LEVEL ** 4.5) * (DUNGEON_EXPONENTS[dungeonType] ?? 0);
	const MAX_XP = DUNGEON_XP_TOTAL[DUNGEON_CAP[dungeonType]] ?? Infinity;

	return {
		dungeonWeight: DUNGEON_WEIGHT,
		dungeonOverflow: XP > MAX_XP
			? ((XP - MAX_XP) / (4 * MAX_XP / DUNGEON_WEIGHT)) ** 0.968
			: 0,
	};
}


/**
 * Lily
 */

export const { getWeightRaw: getLilyWeightRaw } = lilyweight();

/**
 * @param {skyBlockData} skyBlockData
 */
export function getLilyWeight(skyBlockData) {
	const { total, skill: { overflow } } = getLilyWeightRaw(
		Object.keys(skyBlockData.skillXp).slice(0, -2)
			.map(skill => getSkillLevel(skill, skyBlockData, SKILL_CAP[skill]).trueLevel), // skill levels
		Object.values(skyBlockData.skillXp).slice(0, -2), // skill xp
		Object.fromEntries(Object.entries(skyBlockData.dungeonCompletions.normal).slice(0, 7)), // catacombs completions
		Object.fromEntries(Object.entries(skyBlockData.dungeonCompletions.master).slice(0, 5)), // master catacombs completions
		skyBlockData.dungeonXp.catacombs, // catacombs xp
		Object.values(skyBlockData.slayerXp), // slayer xp
	);

	return {
		skillApiEnabled: skyBlockData.skillApiEnabled,
		weight: total - overflow,
		overflow,
		totalWeight: total,
	};
}
