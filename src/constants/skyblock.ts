import { days, hours } from '../functions';
import type { ArrayElement } from '../types/util';

/**
 * misc
 */

export const enum FindProfileStrategy {
	MaxWeight = 'max weight',
	LastActive = 'last active',
}

export const SKYBLOCK_YEAR_0 = 1_560_275_700_000;
export const MAYOR_CHANGE_INTERVAL = days(5) + hours(4);
export const PROFILE_NAMES = [
	'Apple',
	'Banana',
	'Blueberry',
	'Coconut',
	'Cucumber',
	'Grapes',
	'Kiwi',
	'Lemon',
	'Lime',
	'Mango',
	'Orange',
	'Papaya',
	'Peach',
	'Pear',
	'Pineapple',
	'Pomegranate',
	'Raspberry',
	'Strawberry',
	'Tomato',
	'Watermelon',
	'Zucchini',
] as const;

export const STATS_URL_BASE = 'https://sky.shiiyu.moe/stats/';

/**
 * SKILLS
 */

export const SKILLS = [
	'taming',
	'farming',
	'mining',
	'combat',
	'foraging',
	'fishing',
	'enchanting',
	'alchemy',
] as const;

export const COSMETIC_SKILLS = ['carpentry', 'runecrafting'] as const;

export const SKILL_ACHIEVEMENTS = {
	farming: 'skyblock_harvester',
	mining: 'skyblock_excavator',
	combat: 'skyblock_combat',
	foraging: 'skyblock_gatherer',
	fishing: 'skyblock_angler',
	enchanting: 'skyblock_augmentation',
	alchemy: 'skyblock_concoctor',
	taming: 'skyblock_domesticator',
} as const;

export const SKILL_XP = {
	1: 50,
	2: 125,
	3: 200,
	4: 300,
	5: 500,
	6: 750,
	7: 1_000,
	8: 1_500,
	9: 2_000,
	10: 3_500,
	11: 5_000,
	12: 7_500,
	13: 10_000,
	14: 15_000,
	15: 20_000,
	16: 30_000,
	17: 50_000,
	18: 75_000,
	19: 100_000,
	20: 200_000,
	21: 300_000,
	22: 400_000,
	23: 500_000,
	24: 600_000,
	25: 700_000,
	26: 800_000,
	27: 900_000,
	28: 1_000_000,
	29: 1_100_000,
	30: 1_200_000,
	31: 1_300_000,
	32: 1_400_000,
	33: 1_500_000,
	34: 1_600_000,
	35: 1_700_000,
	36: 1_800_000,
	37: 1_900_000,
	38: 2_000_000,
	39: 2_100_000,
	40: 2_200_000,
	41: 2_300_000,
	42: 2_400_000,
	43: 2_500_000,
	44: 2_600_000,
	45: 2_750_000,
	46: 2_900_000,
	47: 3_100_000,
	48: 3_400_000,
	49: 3_700_000,
	50: 4_000_000,
} as const;

export const SKILL_XP_PAST_50 = {
	51: 4_300_000,
	52: 4_600_000,
	53: 4_900_000,
	54: 5_200_000,
	55: 5_500_000,
	56: 5_800_000,
	57: 6_100_000,
	58: 6_400_000,
	59: 6_700_000,
	60: 7_000_000,
} as const;

export const SKILL_XP_TOTAL = Object.fromEntries(
	[...Object.entries(SKILL_XP), ...Object.entries(SKILL_XP_PAST_50)].map(([level], index) => [
		level,
		[...Object.values(SKILL_XP), ...Object.values(SKILL_XP_PAST_50)]
			.slice(0, index + 1)
			.reduce((acc, curr) => acc + curr, 0),
	]),
);

export const RUNECRAFTING_XP = {
	1: 50,
	2: 100,
	3: 125,
	4: 160,
	5: 200,
	6: 250,
	7: 315,
	8: 400,
	9: 500,
	10: 625,
	11: 785,
	12: 1_000,
	13: 1_250,
	14: 1_600,
	15: 2_000,
	16: 2_465,
	17: 3_125,
	18: 4_000,
	19: 5_000,
	20: 6_200,
	21: 7_800,
	22: 9_800,
	23: 12_200,
	24: 15_300,
	25: 19_050,
} as const;

const SKILL_CAP = {
	taming: 50,
	farming: 60,
	mining: 60,
	combat: 60,
	foraging: 50,
	fishing: 50,
	enchanting: 60,
	alchemy: 50,
	carpentry: 50,
	runecrafting: 25,
} as const;

export type SkillTypes = ArrayElement<typeof SKILLS> | ArrayElement<typeof COSMETIC_SKILLS>;

/**
 * dungeons
 */

export const DUNGEON_XP = {
	1: 50,
	2: 75,
	3: 110,
	4: 160,
	5: 230,
	6: 330,
	7: 470,
	8: 670,
	9: 950,
	10: 1_340,
	11: 1_890,
	12: 2_665,
	13: 3_760,
	14: 5_260,
	15: 7_380,
	16: 10_300,
	17: 14_400,
	18: 20_000,
	19: 27_600,
	20: 38_000,
	21: 52_500,
	22: 71_500,
	23: 97_000,
	24: 132_000,
	25: 180_000,
	26: 243_000,
	27: 328_000,
	28: 445_000,
	29: 600_000,
	30: 800_000,
	31: 1_065_000,
	32: 1_410_000,
	33: 1_900_000,
	34: 2_500_000,
	35: 3_300_000,
	36: 4_300_000,
	37: 5_600_000,
	38: 7_200_000,
	39: 9_200_000,
	40: 12_000_000,
	41: 15_000_000,
	42: 19_000_000,
	43: 24_000_000,
	44: 30_000_000,
	45: 38_000_000,
	46: 48_000_000,
	47: 60_000_000,
	48: 75_000_000,
	49: 93_000_000,
	50: 116_250_000,
} as const;

export const DUNGEON_XP_TOTAL = Object.fromEntries(
	Object.entries(DUNGEON_XP).map(([level], index) => [
		level,
		Object.values(DUNGEON_XP)
			.slice(0, index + 1)
			.reduce((acc, curr) => acc + curr, 0),
	]),
);

const DUNGEON_CAP = {
	catacombs: 50,
	healer: 50,
	mage: 50,
	berserk: 50,
	archer: 50,
	tank: 50,
} as const;

export const DUNGEON_TYPES = ['catacombs'] as const;

export const DUNGEON_CLASSES = ['healer', 'mage', 'berserk', 'archer', 'tank'] as const;

export const DUNGEON_TYPES_AND_CLASSES = [...DUNGEON_TYPES, ...DUNGEON_CLASSES] as const;

export const DUNGEON_TYPES_AND_CLASSES_SET = new Set(DUNGEON_TYPES_AND_CLASSES);

export type DungeonTypes = ArrayElement<typeof DUNGEON_TYPES_AND_CLASSES>;

/**
 * SLAYERS
 */

export const SLAYERS = ['zombie', 'spider', 'wolf', 'enderman', 'blaze'] as const;

export type SlayerTypes = ArrayElement<typeof SLAYERS>;

export const SLAYER_XP = {
	1: 5,
	2: 15,
	3: 200,
	4: 1_000,
	5: 5_000,
	6: 20_000,
	7: 100_000,
	8: 400_000,
	9: 1_000_000,
} as const;

/**
 * MISC
 */

export const LEVEL_CAP = {
	...SKILL_CAP,
	...DUNGEON_CAP,
} as const;
