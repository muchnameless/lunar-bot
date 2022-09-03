/* eslint-disable @typescript-eslint/no-duplicate-enum-values, typescript-sort-keys/string-enum */
export const enum ItemRarity {
	Common = 'COMMON',
	Uncommon = 'UNCOMMON',
	Rare = 'RARE',
	Epic = 'EPIC',
	Legendary = 'LEGENDARY',
	Mythic = 'MYTHIC',
	Divine = 'DIVINE',
	Special = 'SPECIAL',
	VerySpecial = 'VERY SPECIAL',
}

export const enum ItemRarityColourCode {
	Common = 'f',
	Uncommon = 'a',
	Rare = '9',
	Epic = '5',
	Legendary = '6',
	Mythic = 'd',
	Divine = 'b',
	Special = 'c',
	VerySpecial = 'c',
}
/* eslint-enable @typescript-eslint/no-duplicate-enum-values, typescript-sort-keys/string-enum */

export const colourCodeToRarity = {
	[ItemRarityColourCode.Common]: ItemRarity.Common,
	[ItemRarityColourCode.Uncommon]: ItemRarity.Uncommon,
	[ItemRarityColourCode.Rare]: ItemRarity.Rare,
	[ItemRarityColourCode.Epic]: ItemRarity.Epic,
	[ItemRarityColourCode.Legendary]: ItemRarity.Legendary,
	[ItemRarityColourCode.Mythic]: ItemRarity.Mythic,
	[ItemRarityColourCode.Divine]: ItemRarity.Divine,
	[ItemRarityColourCode.Special]: ItemRarity.Special,
	// [ItemRarityColourCode.VerySpecial]: ItemRarity.VerySpecial,
} as const;
