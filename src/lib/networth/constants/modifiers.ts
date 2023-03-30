import { Enchantment } from './enchantments.js';

/**
 * multiplicative price modifier for the applied item
 *
 * @see https://github.com/Altpapier/SkyHelper-Networth/blob/master/constants/applicationWorth.js
 */
/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
export const enum PriceModifier {
	AppliedEnchantmentDefault = 0.85,
	ArtOfPeace = 0.8,
	ArtOfWar = 0.6,
	Attributes = 1,
	BookOfStats = 0.6,
	DrillUpgrade = 1,
	DungeonMasterStar = 1,
	Dye = 0.9,
	Essence = 0.75,
	Etherwarp = 1,
	FarmingForDummies = 0.5,
	FumingPotatoBook = 0.6,
	Gemstone = 1,
	GemstoneChamber = 0.9,
	GemstoneSlots = 0.6,
	HotPotatoBook = 1,
	ItemSkin = 0.9,
	JalapenoBook = 0.7,
	ManaDisintegrator = 0.8,
	NecronBladeScroll = 1,
	PetItem = 1,
	PetSkinNoCandy = 0.9,
	PetSkinWithCandy = 0.5,
	PetWithCandy = 0.65,
	PrestigeItem = 1,
	Recomb = 0.8,
	RecombBonemerang = 0.4,
	Reforge = 1,
	Rune = 0.6,
	ShensAuction = 0.85,
	Silex = 0.75,
	TalismanEnrichment = 0.5,
	ThunderInABottle = 0.8,
	TransmissionTuner = 0.7,
	WinningBid = 1,
	WoodSingularity = 0.5,
}
/* eslint-enable @typescript-eslint/no-duplicate-enum-values */

export const ENCHANTMENT_MODIFIERS = {
	[Enchantment.BigBrain]: 0.35,
	[Enchantment.CounterStrike]: 0.2,
	[Enchantment.Overload]: 0.35,
	[Enchantment.UltimateFatalTempo]: 0.65,
	[Enchantment.UltimateInferno]: 0.35,
	[Enchantment.UltimateSoulEater]: 0.35,
} as const satisfies Partial<Record<Enchantment, number>>;
