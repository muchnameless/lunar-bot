import { ItemRarity, ItemId } from './index.js';
import { toTotal } from '#root/lib/functions/array.js';

/**
 * https://github.com/Altpapier/SkyHelperAPI/blob/master/constants/maro_networth/generators/petGenerator.js#L79
 */
export const NON_REDUCED_PETS = new Set([
	//
	ItemId.EnderDragon,
	ItemId.GoldenDragon,
	ItemId.Scatha,
]);

/**
 * https://wiki.hypixel.net/Pets
 */
export const PET_XP = [
	100, 110, 120, 130, 145, 160, 175, 190, 210, 230, 250, 275, 300, 330, 360, 400, 440, 490, 540, 600, 660, 730, 800,
	880, 960, 1_050, 1_150, 1_260, 1_380, 1_510, 1_650, 1_800, 1_960, 2_130, 2_310, 2_500, 2_700, 2_920, 3_160, 3_420,
	3_700, 4_000, 4_350, 4_750, 5_200, 5_700, 6_300, 7_000, 7_800, 8_700, 9_700, 10_800, 12_000, 13_300, 14_700, 16_200,
	17_800, 19_500, 21_300, 23_200, 25_200, 27_400, 29_800, 32_400, 35_200, 38_200, 41_400, 44_800, 48_400, 52_200,
	56_200, 60_400, 64_800, 69_400, 74_200, 79_200, 84_700, 90_700, 97_200, 104_200, 111_700, 119_700, 128_200, 137_200,
	146_700, 156_700, 167_700, 179_700, 192_700, 206_700, 221_700, 237_700, 254_700, 272_700, 291_700, 311_700, 333_700,
	357_700, 383_700, 411_700, 441_700, 476_700, 516_700, 561_700, 611_700, 666_700, 726_700, 791_700, 861_700, 936_700,
	1_016_700, 1_101_700, 1_191_700, 1_286_700, 1_386_700, 1_496_700, 1_616_700, 1_746_700, 1_886_700, 0, 5_555,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
	1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700, 1_886_700,
];

const PET_RARITY_OFFSET = {
	[ItemRarity.Common]: 0,
	[ItemRarity.Uncommon]: 6,
	[ItemRarity.Rare]: 11,
	[ItemRarity.Epic]: 16,
	[ItemRarity.Legendary]: 20,
	[ItemRarity.Mythic]: 20,
} as const satisfies Partial<Record<ItemRarity, number>>;

// pets start at level 1
const MAX_LEVEL_DELTA = 100 - 1;

export const PET_XP_TOTAL = {
	[ItemRarity.Common]: toTotal([
		0,
		0,
		...PET_XP.slice(PET_RARITY_OFFSET[ItemRarity.Common], MAX_LEVEL_DELTA + PET_RARITY_OFFSET[ItemRarity.Common]),
	]),
	[ItemRarity.Uncommon]: toTotal([
		0,
		0,
		...PET_XP.slice(PET_RARITY_OFFSET[ItemRarity.Uncommon], MAX_LEVEL_DELTA + PET_RARITY_OFFSET[ItemRarity.Uncommon]),
	]),
	[ItemRarity.Rare]: toTotal([
		0,
		0,
		...PET_XP.slice(PET_RARITY_OFFSET[ItemRarity.Rare], MAX_LEVEL_DELTA + PET_RARITY_OFFSET[ItemRarity.Rare]),
	]),
	[ItemRarity.Epic]: toTotal([
		0,
		0,
		...PET_XP.slice(PET_RARITY_OFFSET[ItemRarity.Epic], MAX_LEVEL_DELTA + PET_RARITY_OFFSET[ItemRarity.Epic]),
	]),
	[ItemRarity.Legendary]: toTotal([
		0,
		0,
		...PET_XP.slice(PET_RARITY_OFFSET[ItemRarity.Legendary], MAX_LEVEL_DELTA + PET_RARITY_OFFSET[ItemRarity.Legendary]),
	]),
	[ItemRarity.Mythic]: toTotal([
		0,
		0,
		...PET_XP.slice(PET_RARITY_OFFSET[ItemRarity.Mythic], MAX_LEVEL_DELTA + PET_RARITY_OFFSET[ItemRarity.Mythic]),
	]),
	[ItemId.GoldenDragon]: toTotal([
		0,
		0,
		...PET_XP.slice(PET_RARITY_OFFSET[ItemRarity.Mythic], MAX_LEVEL_DELTA + 100 + PET_RARITY_OFFSET[ItemRarity.Mythic]),
	]),
} as const satisfies Partial<Record<ItemId | ItemRarity, readonly number[]>>;
