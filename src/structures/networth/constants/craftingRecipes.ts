import { ItemId } from '.';

const CAMPFIRE_TALISMAN_ADEPT = {
	[ItemId.DarkOakWood]: 160,
} as const;
const CAMPFIRE_TALISMAN_CULTIST = {
	[ItemId.DarkOakWood]: 160,
	[ItemId.SpruceWood]: 1_000,
} as const;
const CAMPFIRE_TALISMAN_SCION = {
	[ItemId.DarkOakWood]: 160,
	[ItemId.SpruceWood]: 1_000,
	[ItemId.AcaciaWood]: 16_000,
} as const;
const CAMPFIRE_TALISMAN_GOD = {
	[ItemId.DarkOakWood]: 160,
	[ItemId.SpruceWood]: 1_000,
	[ItemId.AcaciaWood]: 16_000,
	[ItemId.JungleWood]: 240_000,
} as const;

/**
 * SkyBlock item crafting recipes, holds an array of { id, count } for each item
 */
export const CRAFTING_RECIPES = Object.fromEntries(
	Object.entries({
		// https://hypixel-skyblock.fandom.com/wiki/Artifact_of_Power
		[ItemId.PowerTalisman]: {
			[ItemId.RoughRubyGem]: 3_600,
		},
		[ItemId.PowerRing]: {
			[ItemId.RoughRubyGem]: 48_400,
			[ItemId.RoughJadeGem]: 25_600,
			[ItemId.RoughAmberGem]: 25_600,
			[ItemId.RoughAmethystGem]: 25_600,
			[ItemId.RoughSapphireGem]: 25_600,
			[ItemId.SludgeJuice]: 320,
		},
		[ItemId.PowerArtifact]: {
			[ItemId.RoughRubyGem]: 48_400,
			[ItemId.RoughJadeGem]: 844_800,
			[ItemId.RoughAmberGem]: 844_800,
			[ItemId.RoughAmethystGem]: 844_800,
			[ItemId.RoughSapphireGem]: 844_800,
			[ItemId.SludgeJuice]: 10_560,
		},

		// https://hypixel-skyblock.fandom.com/wiki/Personal_Deletor_7000
		[ItemId.PersonalDeletor4000]: {
			[ItemId.IronIngot]: 18_400,
			[ItemId.Coal]: 51_200,
			[ItemId.Redstone]: 25_600,
		},
		[ItemId.PersonalDeletor5000]: {
			[ItemId.IronIngot]: 54_240,
			[ItemId.Coal]: 51_200,
			[ItemId.Redstone]: 25_600,
		},
		[ItemId.PersonalDeletor6000]: {
			[ItemId.IronIngot]: 125_920,
			[ItemId.Coal]: 51_200,
			[ItemId.Redstone]: 25_600,
		},
		[ItemId.PersonalDeletor7000]: {
			[ItemId.IronIngot]: 305_120,
			[ItemId.Coal]: 51_200,
			[ItemId.Redstone]: 25_600,
		},

		// https://hypixel-skyblock.fandom.com/wiki/Day_Crystal
		[ItemId.DayCrystal]: {
			[ItemId.Quartz]: 26_240,
		},
		[ItemId.NightCrystal]: {
			[ItemId.Quartz]: 26_240,
		},

		// https://hypixel-skyblock.fandom.com/wiki/Campfire_Badge
		[ItemId.CampfireTalisman4]: CAMPFIRE_TALISMAN_ADEPT,
		[ItemId.CampfireTalisman5]: CAMPFIRE_TALISMAN_ADEPT,
		[ItemId.CampfireTalisman6]: CAMPFIRE_TALISMAN_ADEPT,
		[ItemId.CampfireTalisman7]: CAMPFIRE_TALISMAN_ADEPT,
		[ItemId.CampfireTalisman8]: CAMPFIRE_TALISMAN_CULTIST,
		[ItemId.CampfireTalisman9]: CAMPFIRE_TALISMAN_CULTIST,
		[ItemId.CampfireTalisman10]: CAMPFIRE_TALISMAN_CULTIST,
		[ItemId.CampfireTalisman11]: CAMPFIRE_TALISMAN_CULTIST,
		[ItemId.CampfireTalisman12]: CAMPFIRE_TALISMAN_CULTIST,
		[ItemId.CampfireTalisman13]: CAMPFIRE_TALISMAN_SCION,
		[ItemId.CampfireTalisman14]: CAMPFIRE_TALISMAN_SCION,
		[ItemId.CampfireTalisman15]: CAMPFIRE_TALISMAN_SCION,
		[ItemId.CampfireTalisman16]: CAMPFIRE_TALISMAN_SCION,
		[ItemId.CampfireTalisman17]: CAMPFIRE_TALISMAN_SCION,
		[ItemId.CampfireTalisman18]: CAMPFIRE_TALISMAN_SCION,
		[ItemId.CampfireTalisman19]: CAMPFIRE_TALISMAN_SCION,
		[ItemId.CampfireTalisman20]: CAMPFIRE_TALISMAN_SCION,
		[ItemId.CampfireTalisman21]: CAMPFIRE_TALISMAN_GOD,
		[ItemId.CampfireTalisman22]: CAMPFIRE_TALISMAN_GOD,
		[ItemId.CampfireTalisman23]: CAMPFIRE_TALISMAN_GOD,
		[ItemId.CampfireTalisman24]: CAMPFIRE_TALISMAN_GOD,
		[ItemId.CampfireTalisman25]: CAMPFIRE_TALISMAN_GOD,
		[ItemId.CampfireTalisman26]: CAMPFIRE_TALISMAN_GOD,
		[ItemId.CampfireTalisman27]: CAMPFIRE_TALISMAN_GOD,
		[ItemId.CampfireTalisman28]: CAMPFIRE_TALISMAN_GOD,
		[ItemId.CampfireTalisman29]: CAMPFIRE_TALISMAN_GOD,

		// https://hypixel-skyblock.fandom.com/wiki/Mathematical_Hoe_Blueprint
		[ItemId.TheoreticalHoe]: {
			[ItemId.Coins]: 1_000_000, // gold medal
			[ItemId.JacobsTicket]: 32,
		},

		[ItemId.TheoreticalHoeWheat1]: {
			[ItemId.Coins]: 1_000_000, // gold medal
			[ItemId.JacobsTicket]: 32,
			[ItemId.Wheat]: 512,
		},
		[ItemId.TheoreticalHoeWheat2]: {
			[ItemId.Coins]: 1_000_000, // gold medal
			[ItemId.JacobsTicket]: 96,
			[ItemId.Wheat]: 331_776,
		},
		[ItemId.TheoreticalHoeWheat3]: {
			[ItemId.Coins]: 1_000_000, // gold medal
			[ItemId.JacobsTicket]: 352,
			[ItemId.Wheat]: 48_107_520,
		},

		[ItemId.TheoreticalHoeCarrot1]: {
			[ItemId.Coins]: 1_000_000, // gold medal
			[ItemId.JacobsTicket]: 32,
			[ItemId.Carrot]: 512,
		},
		[ItemId.TheoreticalHoeCarrot2]: {
			[ItemId.Coins]: 1_000_000, // gold medal
			[ItemId.JacobsTicket]: 96,
			[ItemId.Carrot]: 41_472,
		},
		[ItemId.TheoreticalHoeCarrot3]: {
			[ItemId.Coins]: 1_000_000, // gold medal
			[ItemId.JacobsTicket]: 352,
			[ItemId.Carrot]: 5_292_544,
			[ItemId.GoldIngot]: 7_282,
		},

		// https://hypixel-skyblock.fandom.com/wiki/Arrows
		[ItemId.FlintArrow]: {
			[ItemId.Coins]: 320 / 64,
		},
		[ItemId.ReinforcedIronArrow]: {
			[ItemId.IronIngot]: 24 / 64,
		},
		[ItemId.GoldTippedArrwow]: {
			[ItemId.GoldIngot]: 40 / 64,
		},
		[ItemId.RedstoneTippedArrow]: {
			[ItemId.Redstone]: (24 * 9) / 64,
		},
		[ItemId.EmeraldTippedArrow]: {
			[ItemId.Emerald]: (16 * 9) / 64,
		},
		[ItemId.BouncyArrow]: {
			[ItemId.SlimeBall]: (24 * 9) / 64,
		},
		[ItemId.IcyArrow]: {
			[ItemId.PackedIce]: 64 / 64,
		},
		[ItemId.ArmorshredArrow]: {
			[ItemId.EnchantedSand]: 2 / 64,
		},
		[ItemId.ExplosiveArrow]: {
			[ItemId.Coal]: (24 * 9) / 64,
		},
		[ItemId.GlueArrow]: {
			[ItemId.TarantulaWeb]: 64 / 64,
		},
		[ItemId.NansorbArrow]: {
			[ItemId.EnchantedCactusGreen]: 8 / 64,
		},
		[ItemId.MagmaArrow]: {
			[ItemId.ArrowBundleMagma]: 1 / 256,
		},
	}).map(([id, recipe]) => [id, Object.entries(recipe).map(([_id, count]) => ({ id: _id, count }))]),
);
