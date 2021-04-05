'use strict';
const { dungeonClasses, dungeonTypes, dungeonXp, runecraftingXp, levelingXp, skillsCap, skillXpPast50, skills, slayers } = require('../constants/skyblock');
const { SKILL_EXPONENTS, SKILL_DIVIDER, SLAYER_DIVIDER, SLAYER_MODIFIER, DUNGEON_EXPONENTS } = require('../constants/weight');


/**
 * returns the true and progression level for the provided skill type
 * @param {string} type the skill or dungeon type
 * @param {number} xp
 * @param {number} individualCap individual level cap for the player
 */
function getSkillLevel(type, xp, individualCap) {
	let xpTable = [ ...dungeonClasses, ...dungeonTypes ].includes(type)
		? dungeonXp
		: type === 'runecrafting'
			? runecraftingXp
			: levelingXp;
	let maxLevel = Math.max(...Object.keys(xpTable));

	if (skillsCap[type] > maxLevel) {
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
	let skillApiEnabled = true;

	for (const skill of skills) {
		const xp = skyblockMember[`experience_skill_${skill}`] ?? ((skillApiEnabled = false) || 0);
		const { nonFlooredLevel: level } = getSkillLevel(skill, xp, skill === 'farming' ? 50 + (skyblockMember.jacob2?.perks?.farming_level_cap ?? 0) : null);

		let maxXp = Object.values(levelingXp).reduce((acc, currentXp) => acc + currentXp, 0);

		if (skillsCap[skill] > 50) maxXp += Object.values(skillXpPast50).reduce((acc, currentXp) => acc + currentXp, 0);

		weight += ((level * 10) ** (0.5 + SKILL_EXPONENTS[skill] + (level / 100))) / 1250;
		if (xp > maxXp) overflow += ((xp - maxXp) / SKILL_DIVIDER[skill]) ** 0.968;
	}

	for (const slayer of slayers) {
		const experience = skyblockMember.slayer_bosses?.[slayer]?.xp ?? 0;

		if (experience <= 1_000_000) {
			weight += experience === 0
				? 0
				: experience / SLAYER_DIVIDER[slayer];
		} else {
			weight += 1_000_000 / SLAYER_DIVIDER[slayer];

			// calculate overflow
			let remaining = experience - 1_000_000;
			let modifier = SLAYER_MODIFIER[slayer];

			while (remaining > 0) {
				const left = Math.min(remaining, 1_000_000);

				weight += (left / (SLAYER_DIVIDER[slayer] * (1.5 + modifier))) ** 0.942;
				modifier += SLAYER_MODIFIER[slayer];
				remaining -= left;
			}
		}
	}

	const maxXp = Object.values(dungeonXp).reduce((acc, xp) => acc + xp, 0);

	for (const type of dungeonTypes) {
		const xp = skyblockMember.dungeons?.dungeon_types?.[type]?.experience ?? 0;
		const { nonFlooredLevel: level } = getSkillLevel(type, xp);
		const base = (level ** 4.5) * DUNGEON_EXPONENTS[type];

		weight += base;
		if (xp > maxXp) overflow += ((xp - maxXp) / (4 * maxXp / base)) ** 0.968;
	}

	for (const dungeonClass of dungeonClasses) {
		const xp = skyblockMember.dungeons?.player_classes?.[dungeonClass]?.experience ?? 0;
		const { nonFlooredLevel: level } = getSkillLevel(dungeonClass, xp);
		const base = (level ** 4.5) * DUNGEON_EXPONENTS[dungeonClass];

		weight += base;
		if (xp > maxXp) overflow += ((xp - maxXp) / (4 * maxXp / base)) ** 0.968;
	}

	return {
		skillApiEnabled,
		weight,
		overflow,
		total: weight + overflow,
	};
}


module.exports = {
	getSkillLevel,
	getWeight,
};
