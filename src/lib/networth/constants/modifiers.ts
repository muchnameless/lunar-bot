/* eslint-disable @typescript-eslint/no-duplicate-enum-values, @typescript-eslint/prefer-literal-enum-member */
/**
 * multiplicative price modifier for the applied item
 *
 * https://github.com/Altpapier/SkyHelperAPI/blob/master/constants/maro_networth/generators/itemGenerator.js#L79
 * https://github.com/Altpapier/SkyHelperAPI/blob/master/constants/maro_networth/src/constants/misc.js#L87
 */
export const enum PriceModifier {
	AppliedEnchantment20 = 0.2,
	AppliedEnchantment35 = 0.35,
	AppliedEnchantment65 = 0.65,
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
	GemstoneSlots = GemstoneChamber,
	HotPotatoBook = 1,
	ItemSkin = 0.9,
	JalapenoBook = 0.7,
	ManaDisintegrator = 0.7,
	NecronBladeScroll = 1,
	PetItem = 1,
	PetSkinNoCandy = 0.9,
	PetSkinWithCandy = 0.5,
	PetWithCandy = 0.65,
	PrestigeItem = 1,
	Recomb = 0.8,
	Reforge = 1,
	Rune = 0.6,
	ShensAuction = 0.85,
	Silex = 0.7,
	TalismanEnrichment = 0.5,
	ThunderInABottle = 0.8,
	TransmissionTuner = 0.7,
	WinningBid = 1,
	WoodSingularity = 0.5,
}
/* eslint-enable @typescript-eslint/no-duplicate-enum-values, @typescript-eslint/prefer-literal-enum-member */
