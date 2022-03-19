import { logger } from '../../../functions/logger';

/**
 * returns the enchantment id (name_level) and count
 * @param enchantment
 * @param level
 */
export const getEnchantment = (enchantment: string, level: number) => {
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
			return { itemId: `${enchantment}_${level}`, count: 1 };

		case 'compact':
		case 'cultivating':
		case 'expertise':
			return { itemId: `${enchantment}_1`, count: 1 };

		case 'fire_aspect':
		case 'frost_walker':
		case 'knockback':
		case 'punch':
			if (level <= 2) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1) };
			return { itemId: `${enchantment}_${level}`, count: 1 };

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
			if (level <= 3) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1) };
			return { itemId: `${enchantment}_${level}`, count: 1 };

		case 'first_strike':
		case 'triple_strike':
			if (level <= 4) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1) };
			return { itemId: `${enchantment}_${level}`, count: 1 };

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
			if (level <= 5) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1) };
			return { itemId: `${enchantment}_${level}`, count: 1 };

		case 'feather_falling':
		case 'infinite_quiver':
			if (level <= 5) return { itemId: `${enchantment}_1`, count: 2 ** (level - 1) };
			if (level <= 10) return { itemId: `${enchantment}_6`, count: 2 ** (level - 6) };
			return { itemId: `${enchantment}_${level}`, count: 1 };

		case 'big_brain':
		case 'vicious':
			return { itemId: `${enchantment}_3`, count: 2 ** (level - 3) };

		default:
			if (enchantment.startsWith('ultimate_') || enchantment.startsWith('turbo_')) {
				return { itemId: `${enchantment}_1`, count: 2 ** (level - 1) };
			}

			logger.warn(`[GET ENCHANTMENT TYPE]: unknown enchantment '${enchantment}', level: '${level}'`);
			return { itemId: `${enchantment}_${level}`, count: 1 };
	}
};
