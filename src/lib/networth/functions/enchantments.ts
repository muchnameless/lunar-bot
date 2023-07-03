import { Enchantment } from '../constants/index.js';
import { Warnings } from '#structures/Warnings.js';

const warnings = new Warnings<string>();

interface EnchantmentData {
	count: number;
	itemId: `ENCHANTMENT_${string}`;
}

/**
 * returns the enchantment id (name_level) and count
 *
 * @see https://hypixel-skyblock.fandom.com/wiki/Enchantments
 * @see https://wiki.hypixel.net/Enchantments
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
			return { itemId: `ENCHANTMENT_${enchantment}_1`, count: 1 };

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
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

		// combinable 1->2
		case Enchantment.FireAspect:
		case Enchantment.FrostWalker:
		case Enchantment.Knockback:
		case Enchantment.Punch:
			if (level <= 2) return { itemId: `ENCHANTMENT_${enchantment}_1`, count: 2 ** (level - 1) };
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

		// combinable 1->3
		case Enchantment.Chance:
		case Enchantment.Dedication:
		case Enchantment.DepthStrider:
		case Enchantment.DivineGift:
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
			if (level <= 3) return { itemId: `ENCHANTMENT_${enchantment}_1`, count: 2 ** (level - 1) };
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

		// combinable 1->4
		case Enchantment.FirstStrike:
		case Enchantment.TripleStrike:
			if (level <= 4) return { itemId: `ENCHANTMENT_${enchantment}_1`, count: 2 ** (level - 1) };
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

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
		case Enchantment.GreenThumb:
		case Enchantment.Growth:
		case Enchantment.Harvesting:
		case Enchantment.Lethality:
		case Enchantment.Luck:
		case Enchantment.LuckOfTheSea:
		case Enchantment.Lure:
		case Enchantment.Magnet:
		case Enchantment.Overload:
		case Enchantment.Piscary:
		case Enchantment.Power:
		case Enchantment.Pristine:
		case Enchantment.ProjectileProtection:
		case Enchantment.Prosecute:
		case Enchantment.Prosperity:
		case Enchantment.Protection:
		case Enchantment.Reflection:
		case Enchantment.Rejuvenate:
		case Enchantment.Respite:
		case Enchantment.Sharpness:
		case Enchantment.SmartyPants:
		case Enchantment.Smite:
		case Enchantment.Smoldering:
		case Enchantment.SpikedHook:
		case Enchantment.Sunder:
		case Enchantment.Thunderbolt:
		case Enchantment.Thunderlord:
		case Enchantment.TitanKiller:
		case Enchantment.Vampirism:
		case Enchantment.Venomous:
			if (level <= 5) return { itemId: `ENCHANTMENT_${enchantment}_1`, count: 2 ** (level - 1) };
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

		// combinable 1->10
		case Enchantment.FerociousMana:
		case Enchantment.HardenedMana:
		case Enchantment.ManaVampire:
		case Enchantment.StrongMana:
			if (level <= 10) return { itemId: `ENCHANTMENT_${enchantment}_1`, count: 2 ** (level - 1) };
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

		// combinable 1->5, 6->10
		case Enchantment.FeatherFalling:
		case Enchantment.InfiniteQuiver:
			if (level <= 5) return { itemId: `ENCHANTMENT_${enchantment}_1`, count: 2 ** (level - 1) };
			if (level <= 10) return { itemId: `ENCHANTMENT_${enchantment}_6`, count: 2 ** (level - 6) };
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

		// combinable 2->3
		case Enchantment.Tabasco:
			if (level <= 3) return { itemId: `ENCHANTMENT_${enchantment}_2`, count: 2 ** (level - 2) };
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

		// combinable 3->5
		case Enchantment.BigBrain:
		case Enchantment.Quantum:
		case Enchantment.Vicious:
			if (level <= 5) return { itemId: `ENCHANTMENT_${enchantment}_3`, count: 2 ** (level - 3) };
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

		// combinable 4->5
		case Enchantment.Cayenne:
		case Enchantment.Transylvanian:
		case Enchantment.UltimateTheOne:
			if (level <= 5) return { itemId: `ENCHANTMENT_${enchantment}_4`, count: 2 ** (level - 4) };
			return { itemId: `ENCHANTMENT_${enchantment}_${level}`, count: 1 };

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
		case Enchantment.UltimateBobbinTime:
		case Enchantment.UltimateChimera:
		case Enchantment.UltimateCombo:
		case Enchantment.UltimateDuplex:
		case Enchantment.UltimateFatalTempo:
		case Enchantment.UltimateFlash:
		case Enchantment.UltimateHabaneroTactics:
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
			return { itemId: `ENCHANTMENT_${enchantment}_1`, count: 2 ** (level - 1) };

		default: {
			// make sure TS errors if the switch is not exhaustive
			const never: never = enchantment;
			const itemId = `${never}_${level}`;

			warnings.emit(itemId, { enchantment, lvl: level }, '[GET ENCHANTMENT]: unknown enchantment');

			// unknown ultimate and turbo enchantments fallback
			if (itemId.startsWith('ultimate_') || itemId.startsWith('turbo_')) {
				return { itemId: `ENCHANTMENT_${enchantment}_1`, count: 2 ** (level - 1) };
			}

			// generic fallback
			return { itemId: `ENCHANTMENT_${itemId}`, count: 1 };
		}
	}
};
