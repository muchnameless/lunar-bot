/**
 * multiplicative price modifier for the applied item
 *
 * https://github.com/Altpapier/SkyHelperAPI/blob/master/constants/maro_networth/generators/itemGenerator.js#L79
 * https://github.com/Altpapier/SkyHelperAPI/blob/master/constants/maro_networth/src/constants/misc.js#L87
 */
export const enum PriceModifier {
	AppliedEnchantment20 = 0.2,
	AppliedEnchantment35 = 0.35,
	AppliedEnchantmentDefault = 0.85,
	ArtOfWar = 0.6,
	BookOfStats = 0.6,
	DrillUpgrade = 1,
	DungeonMasterStar = 1,
	Dye = 0.9,
	Essence = 0.75,
	EtherwarpConduit = 1,
	EtherwarpMerger = 1,
	FarmingForDummies = 0.5,
	FumingPotatoBook = 0.6,
	Gemstone = 1,
	GemstoneChamber = 0.9,
	HotPotatoBook = 1,
	ItemSkin = 0.9,
	NecronBladeScroll = 0.5,
	PetItem = 1,
	PetSkinNoCandy = 0.9,
	PetSkinWithCandy = 0.5,
	PetWithCandy = 0.65,
	Recomb = 0.8,
	Reforge = 1,
	Rune = 0.5,
	Silex = 0.7,
	TalismanEnrichment = 0.75,
	TransmissionTuner = 0.7,
	WoodSingularity = 0.5,
}
