import { Enchantment, PriceModifier } from '../constants';

export function getAppliedEnchantmentModifier(enchantment: Enchantment) {
	switch (enchantment) {
		case Enchantment.Overload:
		case Enchantment.UltimateSoulEater:
		case Enchantment.UltimateInferno:
		case Enchantment.UltimateFatalTempo:
		case Enchantment.BigBrain:
			return PriceModifier.AppliedEnchantment35;

		case Enchantment.CounterStrike:
			return PriceModifier.AppliedEnchantment20;

		default:
			return PriceModifier.AppliedEnchantmentDefault;
	}
}
