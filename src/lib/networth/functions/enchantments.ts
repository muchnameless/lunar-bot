import { logger } from '#logger';
import { Enchantment } from '../constants';

const warnings = new Set<string>();

interface EnchantmentData {
	itemId: string;
	count: number;
	/**
	 * if there are multiple base levels to upgrade, e.g. 1->5, 6->10 would include 6 for levels below 6
	 */
	higherBaseLvls: string[] | null;
}

/**
 * returns the enchantment id (name_level) and count
 * @link https://hypixel-skyblock.fandom.com/wiki/Enchantments
 * @link https://wiki.hypixel.net/Enchantments
 * @param enchantment
 * @param level
 */
export const getEnchantment = (enchantment: Enchantment, level: number): EnchantmentData => {
	switch (enchantment) {
		// not combinable, upgradable via usage
		case Enchantment.Champion:
		case Enchantment.Compact:
		case Enchantment.Cultivating:
		case Enchantment.Expertise:
		case Enchantment.Hecatomb:
			return { itemId: `${enchantment}_1`, count: 1, higherBaseLvls: null };

		// not combinable
		case Enchantment.AquaAffinity:
		case Enchantment.CounterStrike:
		case Enchantment.Delicate:
		case Enchantment.Flame:
		case Enchantment.Piercing:
		case Enchantment.Rainbow:
		case Enchantment.Replenish:
		case Enchantment.SilkTouch:
		case Enchantment.SmeltingTouch:
		case Enchantment.Telekinesis:
		case Enchantment.TrueProtection:
			return { itemId: `${enchantment}_${level}`, count: 1, higherBaseLvls: null };

		// combinable 1->2
		case Enchantment.FireAspect:
		case Enchantment.FrostWalker:
		case Enchantment.Knockback:
		case Enchantment.Punch:
			if (level <= 2) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1), higherBaseLvls: null };
			return { itemId: `${enchantment}_${level}`, count: 1, higherBaseLvls: null };

		// combinable 1->3
		case Enchantment.Chance:
		case Enchantment.DepthStrider:
		case Enchantment.Experience:
		case Enchantment.Fortune:
		case Enchantment.Impaling:
		case Enchantment.LifeSteal:
		case Enchantment.Looting:
		case Enchantment.ManaSteal:
		case Enchantment.Respiration:
		case Enchantment.Scavenger:
		case Enchantment.Snipe:
		case Enchantment.SugarRush:
		case Enchantment.Syphon:
		case Enchantment.Thorns:
			if (level <= 3) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1), higherBaseLvls: null };
			return { itemId: `${enchantment}_${level}`, count: 1, higherBaseLvls: null };

		// combinable 1->4
		case Enchantment.FirstStrike:
		case Enchantment.TripleStrike:
			if (level <= 4) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1), higherBaseLvls: null };
			return { itemId: `${enchantment}_${level}`, count: 1, higherBaseLvls: null };

		// combinable 1->5
		case Enchantment.Angler:
		case Enchantment.BaneOfArthropods:
		case Enchantment.BlastProtection:
		case Enchantment.Blessing:
		case Enchantment.Caster:
		case Enchantment.Charm:
		case Enchantment.Cleave:
		case Enchantment.Corruption:
		case Enchantment.Critical:
		case Enchantment.Cubism:
		case Enchantment.DragonHunter:
		case Enchantment.DragonTracer:
		case Enchantment.Efficiency:
		case Enchantment.EnderSlayer:
		case Enchantment.Execute:
		case Enchantment.FireProtection:
		case Enchantment.Frail:
		case Enchantment.GiantKiller:
		case Enchantment.Growth:
		case Enchantment.Harvesting:
		case Enchantment.Lethality:
		case Enchantment.Luck:
		case Enchantment.LuckOfTheSea:
		case Enchantment.Lure:
		case Enchantment.Magnet:
		case Enchantment.Overload:
		case Enchantment.Power:
		case Enchantment.Pristine:
		case Enchantment.ProjectileProtection:
		case Enchantment.Prosecute:
		case Enchantment.Protection:
		case Enchantment.Rejuvenate:
		case Enchantment.Respite:
		case Enchantment.Sharpness:
		case Enchantment.SmartyPants:
		case Enchantment.Smite:
		case Enchantment.Smoldering:
		case Enchantment.SpikedHook:
		case Enchantment.Thunderbolt:
		case Enchantment.Thunderlord:
		case Enchantment.TitanKiller:
		case Enchantment.Vampirism:
		case Enchantment.Venomous:
			if (level <= 5) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1), higherBaseLvls: null };
			return { itemId: `${enchantment}_${level}`, count: 1, higherBaseLvls: null };

		// combinable 1->10
		case Enchantment.FerociousMana:
		case Enchantment.HardenedMana:
		case Enchantment.ManaVampire:
		case Enchantment.StrongMana:
			if (level <= 10) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1), higherBaseLvls: null };
			return { itemId: `${enchantment}_${level}`, count: 1, higherBaseLvls: null };

		// combinable 1->5, 6->10
		case Enchantment.FeatherFalling:
		case Enchantment.InfiniteQuiver:
			if (level <= 5) {
				return { itemId: `${enchantment}_1`, count: 2 ** (level - 1), higherBaseLvls: [`${enchantment}_6`] };
			}
			if (level <= 10) {
				return { itemId: `${enchantment}_6`, count: 2 ** (level - 6), higherBaseLvls: null };
			}
			return { itemId: `${enchantment}_${level}`, count: 1, higherBaseLvls: null };

		// combinable 3->5
		case Enchantment.BigBrain:
		case Enchantment.Vicious:
			return { itemId: `${enchantment}_3`, count: 2 ** (level - 3), higherBaseLvls: null };

		// combinable 4->5
		case Enchantment.Cayenne:
			return { itemId: `${enchantment}_4`, count: 2 ** (level - 4), higherBaseLvls: null };

		// combinable 1->x
		case Enchantment.TurboCactus: // turbo
		case Enchantment.TurboCane:
		case Enchantment.TurboCarrot:
		case Enchantment.TurboCoco:
		case Enchantment.TurboMelon:
		case Enchantment.TurboMushrooms:
		case Enchantment.TurboPotato:
		case Enchantment.TurboPumpkin:
		case Enchantment.TurboWarts:
		case Enchantment.TurboWheat:
		case Enchantment.UltimateBank: // ultimate
		case Enchantment.UltimateChimera:
		case Enchantment.UltimateCombo:
		case Enchantment.UltimateDuplex:
		case Enchantment.UltimateFatalTempo:
		case Enchantment.UltimateFlash:
		case Enchantment.UltimateInferno:
		case Enchantment.UltimateJerry:
		case Enchantment.UltimateLastStand:
		case Enchantment.UltimateLegion:
		case Enchantment.UltimateNoPainNoGain:
		case Enchantment.UltimateOneForAll:
		case Enchantment.UltimateRend:
		case Enchantment.UltimateSoulEater:
		case Enchantment.UltimateSwarm:
		case Enchantment.UltimateWisdom:
		case Enchantment.UltimateWise:
			return { itemId: `${enchantment}_1`, count: 2 ** (level - 1), higherBaseLvls: null };

		default: {
			// make sure TS errors if the switch is not exhaustive
			const e: never = enchantment;
			const itemId = `${e}_${level}`;

			// log warning only once
			if (!warnings.has(itemId)) {
				warnings.add(itemId);
				logger.warn({ enchantment, lvl: level }, '[GET ENCHANTMENT]: unknown enchantment');
			}

			// unknown ultimate and turbo enchantments fallback
			if (itemId.startsWith('ultimate_') || itemId.startsWith('turbo_')) {
				return { itemId: `${enchantment}_1`, count: 2 ** (level - 1), higherBaseLvls: null };
			}

			// generic fallback
			return { itemId, count: 1, higherBaseLvls: null };
		}
	}
};
