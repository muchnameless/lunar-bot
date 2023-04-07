import { ItemId } from './itemId.js';

/**
 * @see https://github.com/Altpapier/SkyHelper-Networth/blob/master/constants/reforges.js
 * @see https://hypixel-skyblock.fandom.com/wiki/Reforging
 * @see https://wiki.hypixel.net/Reforging
 */
export const REFORGE_TO_STONE = {
	ambered: ItemId.AmberMaterial,
	ancient: ItemId.PrecursorGear,
	aote_stone: ItemId.WarpedStone,
	auspicious: ItemId.RockGemstone,
	blessed: ItemId.BlessedFruit,
	blooming: ItemId.FloweringBouquet,
	bountiful: ItemId.GoldenBall,
	bulky: ItemId.BulkyStone,
	bustling: ItemId.SkyMartBrochure,
	candied: ItemId.CandyCorn,
	chomp: ItemId.KuudraMandible,
	coldfused: ItemId.EntropySuppressor,
	cubic: ItemId.MoltenCube,
	dirty: ItemId.DirtBottle,
	earthy: ItemId.LargeWalnut,
	empowered: ItemId.SadanBrooch,
	fabled: ItemId.DragonClaw,
	fleet: ItemId.Diamonite,
	fortified: ItemId.MeteorShard,
	fruitful: ItemId.Onyx,
	giant: ItemId.GiantTooth,
	gilded: ItemId.MidasJewel,
	glistening: ItemId.ShinyPrism,
	headstrong: ItemId.SalmonOpal,
	heated: ItemId.HotStuff,
	hyper: ItemId.EndstoneGeode,
	jaded: ItemId.Jaderald,
	jerry: ItemId.JerryStone,
	loving: ItemId.RedScarf,
	lucky: ItemId.LuckyDice,
	magnetic: ItemId.LapisCrystal,
	mithraic: ItemId.PureMithril,
	moil: ItemId.MoilLog,
	mossy: ItemId.OvergrownGrass,
	necrotic: ItemId.NecromancerBrooch,
	perfect: ItemId.DiamondAtom,
	pitchin: ItemId.PitchinKoi,
	precise: ItemId.OpticalLens,
	refined: ItemId.RefinedAmber,
	reinforced: ItemId.RareDiamond,
	renowned: ItemId.DragonHorn,
	ridiculous: ItemId.RedNose,
	rooted: ItemId.BurrowingSpores,
	salty: ItemId.SaltCube,
	spiked: ItemId.DragonScale,
	spiritual: ItemId.SpiritStone,
	stellar: ItemId.PetrifiedStarfall,
	stiff: ItemId.HardenedWood,
	strengthened: ItemId.SearingStone,
	submerged: ItemId.DeepSeaOrb,
	suspicious: ItemId.SuspiciousVial,
	toil: ItemId.ToilLog,
	treacherous: ItemId.RustyAnchor,
	undead: ItemId.PremiumFlesh,
	waxed: ItemId.BlazeWax,
	withered: ItemId.WitherBlood,
} as const satisfies Record<string, ItemId>;