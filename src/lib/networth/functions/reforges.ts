import { logger } from '#logger';
import { ItemId } from '../constants';

const warnings = new Set<string>();

/**
 * https://hypixel-skyblock.fandom.com/wiki/Reforging
 * https://wiki.hypixel.net/Reforging
 * @param modifier
 * @param itemId
 */
export const getReforgeStone = (modifier: string, itemId: string) => {
	switch (modifier) {
		case 'jerry_stone':
			return ItemId.JerryStone;
		case 'adept':
			return ItemId.EndStoneShulker;
		case 'ambered':
			return ItemId.AmberMaterial;
		case 'ancient':
			return ItemId.PrecursorGear;
		case 'aote_stone':
			return ItemId.WarpedStone;
		case 'auspicious':
			return ItemId.RockGemstone;
		case 'bizarre':
			return ItemId.EccentricPainting;
		case 'blessed':
			return ItemId.BlessedFruit;
		case 'bloody':
			return ItemId.BeatingHeart;
		case 'bountiful':
			return ItemId.GoldenBall;
		case 'bulky':
			return ItemId.BulkyStone;
		case 'candied':
			return ItemId.CandyCorn;
		case 'chomp':
			return ItemId.KuudraMandible;
		case 'cubic':
			return ItemId.MoltenCube;
		case 'demonic':
			return ItemId.HornsOfTorment;
		case 'dirty':
			return ItemId.DirtBottle;
		case 'empowered':
			return ItemId.SadanBrooch;
		case 'fabled':
			return ItemId.DragonClaw;
		case 'fleet':
			return ItemId.Diamonite;
		case 'forceful':
			return ItemId.AcaciaBirdhouse;
		case 'fortified':
			return ItemId.MeteorShard;
		case 'fruitful':
			return ItemId.Onyx;
		case 'giant':
			return ItemId.GiantTooth;
		case 'gilded':
			return ItemId.MidasJewel;
		case 'glistening':
			return ItemId.ShinyPrism;
		case 'headstrong':
			return ItemId.SalmonOpal;
		case 'healthy':
			return ItemId.VitaminDeath;
		case 'heated':
			return ItemId.HotStuff;
		case 'hurtful':
			return ItemId.MagmaUrchin;
		case 'hyper':
			return ItemId.EndstoneGeode;
		case 'itchy':
			return ItemId.Furball;
		case 'jaded':
			return ItemId.Jaderald;
		case 'loving':
			return ItemId.RedScarf;
		case 'lucky':
			return ItemId.LuckyDice;
		case 'magnetic':
			return ItemId.LapisCrystal;
		case 'mithraic':
			return ItemId.PureMithril;
		case 'moil':
			return ItemId.MoilLog;
		case 'mythical':
			return ItemId.ObsidianTablet;
		case 'necrotic':
			return ItemId.NecromancerBrooch;
		case 'perfect':
			return ItemId.DiamondAtom;
		case 'pleasant':
			return ItemId.PreciousPearl;
		case 'precise':
			return ItemId.OpticalLens;
		case 'refined':
			return ItemId.RefinedAmber;
		case 'reinforced':
			return ItemId.RareDiamond;
		case 'renowned':
			return ItemId.DragonHorn;
		case 'ridiculous':
			return ItemId.RedNose;
		case 'scorching':
			return ItemId.ScorchedBooks;
		case 'shaded':
			return ItemId.DarkOrb;
		case 'sighted':
			return ItemId.EnderMonocle;
		case 'silky':
			return ItemId.LuxuriousSpool;
		case 'slender':
			return ItemId.HazmatEnderman;
		case 'spiked':
			return ItemId.DragonScale;
		case 'spiritual':
			return ItemId.SpiritStone;
		case 'stellar':
			return ItemId.PetrifiedStarfall;
		case 'stiff':
			return ItemId.HardenedWood;
		case 'strengthened':
			return ItemId.SearingStone;
		case 'submerged':
			return ItemId.DeepSeaOrb;
		case 'suspicious':
			return ItemId.SuspiciousVial;
		case 'sweet':
			return ItemId.RockCandy;
		case 'toil':
			return ItemId.ToilLog;
		case 'undead':
			return ItemId.PremiumFlesh;
		case 'warped':
			if ([ItemId.AspectOfTheEnd, ItemId.AspectOfTheVoid].includes(itemId as any)) {
				return ItemId.WarpedStone; // sword reforge stone
			}
			return ItemId.EndstoneGeode; // armor reforge stone (warped renamed to hyper for armor)
		case 'waxed':
			return ItemId.BlazeWax;
		case 'withered':
			return ItemId.WitherBlood;

		// reforges which do not need materials
		case 'awkward':
		case 'clean':
		case 'deadly':
		case 'double_bit':
		case 'epic':
		case 'excellent':
		case 'fair':
		case 'fast':
		case 'fierce':
		case 'fine':
		case 'fortunate':
		case 'gentle':
		case 'godly':
		case 'grand':
		case 'great':
		case 'green thumb':
		case 'hasty':
		case 'heavy':
		case 'heroic':
		case 'keen':
		case 'legendary':
		case 'light':
		case 'lumberjack':
		case 'lush':
		case 'mythic':
		case 'neat':
		case 'odd_sword':
		case 'ominous':
		case 'peasant':
		case 'pretty':
		case 'prospector':
		case 'pure':
		case 'rapid':
		case 'rich_bow':
		case 'robust':
		case 'rugged':
		case 'sharp':
		case 'shiny':
		case 'simple':
		case 'smart':
		case 'spicy':
		case 'strange':
		case 'strong':
		case 'sturdy':
		case 'superior':
		case 'titanic':
		case 'unpleasant':
		case 'unreal':
		case 'unyielding':
		case 'vivid':
		case 'wise':
		case 'zealous':
		case 'zooming':
			return null;

		// reforges which need materials but are ignored too
		case 'salty':
		case 'treacherous':
			return null;

		default:
			// log warning only once
			if (!warnings.has(modifier)) {
				warnings.add(modifier);
				logger.warn({ modifier, itemId }, '[GET REFORGE STONE]: unknown modifier');
			}

			return null;
	}
};
