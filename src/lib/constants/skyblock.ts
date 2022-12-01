import { type ArrayElementType } from '@sapphire/utilities';
import { days, hours, toTotal } from '#functions';

/**
 * misc
 */

export const enum FindProfileStrategy {
	LastActive = 'last active',
	MaxWeight = 'max weight',
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
] as const satisfies readonly string[];

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
] as const satisfies readonly string[];

export const COSMETIC_SKILLS = ['carpentry', 'runecrafting', 'social2'] as const satisfies readonly string[];

export const SKILL_ACHIEVEMENTS = {
	farming: 'skyblock_harvester',
	mining: 'skyblock_excavator',
	combat: 'skyblock_combat',
	foraging: 'skyblock_gatherer',
	fishing: 'skyblock_angler',
	enchanting: 'skyblock_augmentation',
	alchemy: 'skyblock_concoctor',
	taming: 'skyblock_domesticator',
} as const satisfies Record<ArrayElementType<typeof SKILLS>, string>;

export const SKILL_XP = [
	0, 50, 125, 200, 300, 500, 750, 1_000, 1_500, 2_000, 3_500, 5_000, 7_500, 10_000, 15_000, 20_000, 30_000, 50_000,
	75_000, 100_000, 200_000, 300_000, 400_000, 500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000, 1_100_000,
	1_200_000, 1_300_000, 1_400_000, 1_500_000, 1_600_000, 1_700_000, 1_800_000, 1_900_000, 2_000_000, 2_100_000,
	2_200_000, 2_300_000, 2_400_000, 2_500_000, 2_600_000, 2_750_000, 2_900_000, 3_100_000, 3_400_000, 3_700_000,
	4_000_000, 4_300_000, 4_600_000, 4_900_000, 5_200_000, 5_500_000, 5_800_000, 6_100_000, 6_400_000, 6_700_000,
	7_000_000,
] as const satisfies readonly number[];

export const SKILL_XP_TOTAL = toTotal(SKILL_XP);

export const RUNECRAFTING_XP = [
	0, 50, 100, 125, 160, 200, 250, 315, 400, 500, 625, 785, 1_000, 1_250, 1_600, 2_000, 2_465, 3_125, 4_000, 5_000,
	6_200, 7_800, 9_800, 12_200, 15_300, 19_050,
] as const satisfies readonly number[];

export const RUNECRAFTING_XP_TOTAL = toTotal(RUNECRAFTING_XP);

export const SOCIAL_XP = [
	0, 50, 100, 150, 250, 500, 750, 1_000, 1_250, 1_500, 2_000, 2_500, 3_000, 3_750, 4_500, 6_000, 8_000, 10_000, 12_500,
	15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 50_000,
] as const satisfies readonly number[];

export const SOCIAL_XP_TOTAL = toTotal(SOCIAL_XP);

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
	social2: 25,
} as const satisfies Record<SkillTypes, number>;

export type SkillTypes = ArrayElementType<typeof COSMETIC_SKILLS | typeof SKILLS>;

/**
 * dungeons
 */

export const DUNGEON_XP = [
	0, 50, 75, 110, 160, 230, 330, 470, 670, 950, 1_340, 1_890, 2_665, 3_760, 5_260, 7_380, 10_300, 14_400, 20_000,
	27_600, 38_000, 52_500, 71_500, 97_000, 132_000, 180_000, 243_000, 328_000, 445_000, 600_000, 800_000, 1_065_000,
	1_410_000, 1_900_000, 2_500_000, 3_300_000, 4_300_000, 5_600_000, 7_200_000, 9_200_000, 12_000_000, 15_000_000,
	19_000_000, 24_000_000, 30_000_000, 38_000_000, 48_000_000, 60_000_000, 75_000_000, 93_000_000, 116_250_000,
] as const satisfies readonly number[];

export const DUNGEON_XP_TOTAL = toTotal(DUNGEON_XP);

const DUNGEON_CAP = {
	catacombs: 50,
	healer: 50,
	mage: 50,
	berserk: 50,
	archer: 50,
	tank: 50,
} as const satisfies Record<DungeonTypes, number>;

export const DUNGEON_TYPES = ['catacombs'] as const satisfies readonly string[];

export const DUNGEON_CLASSES = ['healer', 'mage', 'berserk', 'archer', 'tank'] as const satisfies readonly string[];

export const DUNGEON_TYPES_AND_CLASSES = [...DUNGEON_TYPES, ...DUNGEON_CLASSES] as const satisfies readonly string[];

export const DUNGEON_TYPES_AND_CLASSES_SET = new Set(DUNGEON_TYPES_AND_CLASSES);

export type DungeonTypes = ArrayElementType<typeof DUNGEON_TYPES_AND_CLASSES>;

/**
 * SLAYERS
 */

export const SLAYERS = ['zombie', 'spider', 'wolf', 'enderman', 'blaze'] as const satisfies readonly string[];

export type SlayerTypes = ArrayElementType<typeof SLAYERS>;

export const SLAYER_XP_TOTAL = [
	0, 5, 15, 200, 1_000, 5_000, 20_000, 100_000, 400_000, 1_000_000,
] as const satisfies readonly number[];

/**
 * MISC
 */

export const LEVEL_CAP = {
	...SKILL_CAP,
	...DUNGEON_CAP,
} as const satisfies Record<string, number>;
