import { transformItemData } from '@zikeji/hypixel';
import {
	ALLOWED_ENCHANTS,
	BLOCKED_ENCHANTS,
	ESSENCE_PRICES,
	ESSENCE_UPGRADES,
	GEMSTONES,
	IGNORED_GEMSTONES,
	MASTER_STARS,
	MATERIALS_TO_ID,
	PET_LEVELS_XP,
	PET_RARITY_OFFSET,
	REFORGES,
	SKYBLOCK_INVENTORIES,
	SPECIAL_GEMSTONES,
	TALISMANS,
} from './constants';
import { getPrice, prices } from './prices';
import type { SkyBlockProfile } from '../../functions';
import type { Buffer } from 'node:buffer';
import type { NBTInventory, NBTInventoryItem, Components } from '@zikeji/hypixel';

/**
 * @param base64
 */
async function parseItems(base64: string | number[] | Buffer) {
	let networth = 0;

	for (const item of await transformItemData(base64)) {
		if (!item) continue;

		// backpacks -> iterate over contained items
		if (item.tag?.display?.Name?.includes('Backpack')) {
			const _items = item.tag.ExtraAttributes![
				Object.keys(item.tag.ExtraAttributes!).find((key) => key.endsWith('_data'))!
			] as NBTInventory;

			if (!Array.isArray(_items)) continue;

			for (const _item of _items) {
				if (!_item) continue;

				networth += calculateItemPrice(_item);
			}

			continue;
		}

		networth += calculateItemPrice(item);
	}

	return networth;
}

/**
 * @param item
 */
function calculateItemPrice(item: NBTInventoryItem) {
	if (typeof item.tag?.ExtraAttributes?.id === 'undefined') return 0;

	const itemId = item.tag.ExtraAttributes.id.toLowerCase();
	const { ExtraAttributes } = item.tag;

	let price = getPrice(itemId) * item.Count;

	// dark auctions
	if (ExtraAttributes.winning_bid && !itemId.includes('hegemony')) {
		price = ExtraAttributes.winning_bid as number;
	}

	// farming tools
	if (itemId.startsWith('theoretical_hoe')) {
		const hoe = ExtraAttributes.id.split('_');
		const level = Number(hoe.at(-1));
		const material = MATERIALS_TO_ID[hoe.at(-2) as keyof typeof MATERIALS_TO_ID];
		const tickets = level === 2 ? (getPrice('jacobs_ticket') ?? 0) * 64 : getPrice('jacobs_ticket') * 256;

		price = 1_000_000 + 256 * getPrice(material) * 144 ** (level - 1) + tickets;
	}

	// enchantments
	if (ExtraAttributes.enchantments) {
		if (itemId === 'enchanted_book') {
			const enchants = Object.keys(ExtraAttributes.enchantments);

			if (enchants.length === 1) {
				price = getPrice(`${enchants[0]}_${ExtraAttributes.enchantments[enchants[0]]}`);
			}
		} else {
			// non books
			for (const [enchant, level] of Object.entries(ExtraAttributes.enchantments)) {
				if (BLOCKED_ENCHANTS[itemId as keyof typeof BLOCKED_ENCHANTS]?.has(enchant) || !ALLOWED_ENCHANTS.has(enchant)) {
					continue;
				}

				if (itemId !== 'stonk_pickaxe' && enchant === 'efficiency' && level > 5) {
					price += getPrice('silex');
				}

				price += getPrice(`${enchant}_${level}`);
			}
		}
	}

	// hot potato books + fuming potato books
	if (ExtraAttributes.hot_potato_count) {
		if (ExtraAttributes.hot_potato_count > 10) {
			price += getPrice('hot_potato_book') * 10;
			price += getPrice('fuming_potato_book') * (ExtraAttributes.hot_potato_count - 10);
		} else {
			price += getPrice('hot_potato_book') * ExtraAttributes.hot_potato_count;
		}
	}

	// art of war
	if (ExtraAttributes.art_of_war_count) {
		price += getPrice('the_art_of_war') * (ExtraAttributes.art_of_war_count as number);
	}

	// farming for dummies
	if (ExtraAttributes.farming_for_dummies_count) {
		price += getPrice('farming_for_dummies') * (ExtraAttributes.farming_for_dummies_count as number);
	}

	// dungeon stars
	if (ExtraAttributes.dungeon_item_level && ESSENCE_UPGRADES[itemId as keyof typeof ESSENCE_UPGRADES]) {
		const essenceItem = ESSENCE_UPGRADES[itemId as keyof typeof ESSENCE_UPGRADES];

		// @ts-expect-error
		let essenceAmount = essenceItem.dungeonize ?? 0;

		// normal stars
		for (let star = Math.min(ExtraAttributes.dungeon_item_level, 5); star > 0; --star) {
			essenceAmount += essenceItem[star as 1 | 2 | 3 | 4 | 5] ?? 0;
		}

		price += essenceAmount * ESSENCE_PRICES[essenceItem.type];

		// master stars
		for (let star = ExtraAttributes.dungeon_item_level - 5; star > 0; --star) {
			price += getPrice(MASTER_STARS[star]);
		}
	}

	// skin
	if (ExtraAttributes.skin) {
		price += getPrice(ExtraAttributes.skin as string);
	}

	// enrichments
	if (item.tag.ExtraAttributes.talisman_enrichment) {
		price += getPrice((ExtraAttributes.talisman_enrichment as string).toLowerCase());
	}

	// recombed
	if (
		(ExtraAttributes.rarity_upgrades ?? 0) > 0 &&
		ExtraAttributes.originTag &&
		(ExtraAttributes.enchantments || TALISMANS.has(itemId))
	) {
		price += getPrice('recombobulator_3000') / 2;
	}

	// gemstones
	if (ExtraAttributes.gems) {
		for (const [key, value] of Object.entries(ExtraAttributes.gems as unknown as Record<string, string>)) {
			if (IGNORED_GEMSTONES.has(key)) continue;

			const [slotType] = key.split('_', 2);

			if (SPECIAL_GEMSTONES.has(slotType)) {
				price += getPrice(
					`${value}_${(ExtraAttributes.gems as unknown as Record<string, string>)[`${key}_gem`]}_gem`.toLowerCase(),
				);
			} else if (GEMSTONES.has(slotType)) {
				price += getPrice(`${value}_${key.split('_', 2)[0]}_gem`.toLowerCase());
			}
		}
	}

	// wooden singularity
	if (ExtraAttributes.wood_singularity_count) {
		price += getPrice('wood_singularity');
	}

	// transmission tuners
	if (ExtraAttributes.tuned_transmission) {
		price += getPrice('transmission_tuner') * (ExtraAttributes.tuned_transmission as number);
	}

	// reforge
	if (ExtraAttributes.modifier && !TALISMANS.has(itemId)) {
		price += getPrice(REFORGES[ExtraAttributes.modifier as keyof typeof REFORGES]);
	}

	// scrolls (Necron's Blade)
	if (ExtraAttributes.ability_scroll) {
		for (const _item of Object.values(ExtraAttributes.ability_scroll as unknown as string[])) {
			price += getPrice(_item.toLowerCase());
		}
	}

	// divan armor
	if (ExtraAttributes.gemstone_slots) {
		price += (ExtraAttributes.gemstone_slots as number) * getPrice('gemstone_chamber');
	}

	// drills
	if (ExtraAttributes.drill_part_upgrade_module) {
		price += getPrice(ExtraAttributes.drill_part_upgrade_module as string);
	}
	if (ExtraAttributes.drill_part_fuel_tank) {
		price += getPrice(ExtraAttributes.drill_part_fuel_tank as string);
	}
	if (ExtraAttributes.drill_part_engine) {
		price += getPrice(ExtraAttributes.drill_part_engine as string);
	}

	// ethermerge (Aspect of the Void)
	if (ExtraAttributes.ethermerge) {
		price += getPrice('etherwarp_conduit') + getPrice('etherwarp_merger');
	}

	return price;
}

/**
 * @param pet
 */
export function calculatePetSkillLevel(pet: Components.Schemas.SkyBlockProfilePet) {
	const maxLevel = pet.type === 'GOLDEN_DRAGON' ? 200 : 100;
	const rarityOffset = PET_RARITY_OFFSET[pet.tier as keyof typeof PET_RARITY_OFFSET];
	const levels = PET_LEVELS_XP.slice(rarityOffset, rarityOffset + maxLevel - 1);

	let level = 1;
	let totalExperience = 0;

	for (let i = 0; i < maxLevel; ++i) {
		totalExperience += levels[i];

		if (totalExperience > pet.exp) {
			totalExperience -= levels[i];
			break;
		}

		++level;
	}

	return {
		maxXP: levels.reduce((a, b) => a + b, 0),
		level: level > maxLevel ? maxLevel : level,
	};
}

/**
 * @param pet
 */
function getPetPrice(pet: Components.Schemas.SkyBlockProfilePet) {
	const lvl1 = prices.get(`lvl_1_${pet.tier}_${pet.type}`.toLowerCase());
	const lvl100 = prices.get(`lvl_100_${pet.tier}_${pet.type}`.toLowerCase());
	const lvl200 = prices.get(`lvl_200_${pet.tier}_${pet.type}`.toLowerCase());
	const { level, maxXP } = calculatePetSkillLevel(pet);

	let price = lvl200 ?? lvl100;

	if (level < 100 && maxXP) {
		if (typeof lvl1 === 'undefined' || typeof lvl100 === 'undefined') return 0;
		price = ((lvl100 - lvl1) / maxXP) * pet.exp + lvl1;
	}

	if (level > 100 && level < 200) {
		if (typeof lvl100 === 'undefined' || typeof lvl200 === 'undefined') return 0;
		price = ((lvl200 - lvl100) / 100) * Number(level.toString().slice(1)) + lvl100;
	}

	if (typeof price === 'undefined') return 0;

	// held item
	if (pet.heldItem && level != 200) {
		price += getPrice(pet.heldItem.toLowerCase());
	}

	// candy
	if (pet.candyUsed! > 0 && pet.type != 'ENDER_DRAGON') {
		price = price / 1.538_232;
	}

	// skin
	if (pet.skin) {
		price += getPrice(`pet_skin_${pet.skin.toLowerCase()}`);
	}

	return price;
}

/**
 * @param profile
 * @param uuid
 */
export async function getNetworth({ banking, members }: SkyBlockProfile, uuid: string) {
	const member = members[uuid];

	let bankingAPIEnabled = true;
	let networth = banking?.balance ?? ((bankingAPIEnabled = false), 0) + member.coin_purse ?? 0;

	const promises: Promise<number>[] = [];

	let inventoryAPIEnabled = true;

	for (const inventory of SKYBLOCK_INVENTORIES) {
		const data = member[inventory]?.data;

		if (!data) {
			if (inventory === 'inv_contents') inventoryAPIEnabled = false;
			continue;
		}

		promises.push(parseItems(data));
	}

	if (member.backpack_contents) {
		for (const backpack of Object.values(member.backpack_contents)) {
			promises.push(parseItems(backpack.data));
		}
	}

	for (const inventoryPrice of await Promise.all(promises)) {
		networth += inventoryPrice;
	}

	if (member.sacks_counts) {
		for (const [index, count] of Object.entries(member.sacks_counts)) {
			networth += getPrice(index.toLowerCase()) * (count ?? 0);
		}
	}

	if (member.pets) {
		for (const pet of member.pets) {
			networth += getPetPrice(pet);
		}
	}

	return {
		networth,
		bankingAPIEnabled,
		inventoryAPIEnabled,
	};
}
