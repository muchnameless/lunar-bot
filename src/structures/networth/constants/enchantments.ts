import { logger } from '../../../functions';

export const enum EnchantmentType {
	AnvilUpgradableFrom1,
	AnvilUpgradableFrom3,
	AnvilUpgradableFrom6,
	NotUpgradable,
	UsageUpgradable,
}

/**
 * wether the enchantment is upgradable via an anvil
 * @param enchantment
 */
export const getEnchantmentType = (enchantment: string, level: number) => {
	if (enchantment.startsWith('ultimate_') || enchantment.startsWith('turbo_')) {
		return EnchantmentType.AnvilUpgradableFrom1;
	}

	switch (enchantment) {
		case 'aqua_affinity':
		case 'counter_strike':
		case 'delicate':
		case 'flame':
		case 'piercing':
		case 'rainbow':
		case 'replenish':
		case 'silk_touch':
		case 'smelting_touch':
		case 'telekinesis':
		case 'true_protection':
			return EnchantmentType.NotUpgradable;

		case 'compact':
		case 'cultivating':
		case 'expertise':
			return EnchantmentType.UsageUpgradable;

		case 'fire_aspect':
		case 'frost_walker':
		case 'knockback':
		case 'punch':
			return level <= 2 ? EnchantmentType.AnvilUpgradableFrom1 : EnchantmentType.NotUpgradable;

		case 'chance':
		case 'depth_strider':
		case 'experience':
		case 'fortune':
		case 'impaling':
		case 'life_steal':
		case 'looting':
		case 'mana_steal':
		case 'respiration':
		case 'scavenger':
		case 'snipe':
		case 'sugar_rush':
		case 'syphon':
		case 'thorns':
			return level <= 3 ? EnchantmentType.AnvilUpgradableFrom1 : EnchantmentType.NotUpgradable;

		case 'first_strike':
		case 'triple_strike':
			return level <= 4 ? EnchantmentType.AnvilUpgradableFrom1 : EnchantmentType.NotUpgradable;

		case 'aiming':
		case 'angler':
		case 'bane_of_arthropods':
		case 'blast_protection':
		case 'blessing':
		case 'caster':
		case 'cleave':
		case 'critical':
		case 'cubism':
		case 'dragon_hunter':
		case 'dragon_tracer':
		case 'efficiency':
		case 'ender_slayer':
		case 'execute':
		case 'fire_protection':
		case 'frail':
		case 'giant_killer':
		case 'growth':
		case 'harvesting':
		case 'lethality':
		case 'luck':
		case 'luck_of_the_sea':
		case 'lure':
		case 'magnet':
		case 'overload':
		case 'power':
		case 'pristine':
		case 'projectile_protection':
		case 'PROSECUTE': // api inconsistency
		case 'protection':
		case 'rejuvenate':
		case 'respite':
		case 'sharpness':
		case 'smarty_pants':
		case 'smite':
		case 'spiked_hook':
		case 'thunderbolt':
		case 'thunderlord':
		case 'titan_killer':
		case 'vampirism':
		case 'venomous':
			return level <= 5 ? EnchantmentType.AnvilUpgradableFrom1 : EnchantmentType.NotUpgradable;

		case 'feather_falling':
		case 'infinite_quiver':
			if (level <= 5) return EnchantmentType.AnvilUpgradableFrom1;
			if (level <= 10) return EnchantmentType.AnvilUpgradableFrom6;
			return EnchantmentType.NotUpgradable;

		case 'big_brain':
		case 'vicious':
			return EnchantmentType.AnvilUpgradableFrom3;

		default:
			logger.warn(`[ENCHANTMENT]: unknown enchantment '${enchantment}', level: '${level}'`);
			return EnchantmentType.NotUpgradable;
	}
};
