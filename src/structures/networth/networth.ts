import { transformItemData } from '@zikeji/hypixel';
import { logger } from '../../functions';
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
		if (!item?.tag?.ExtraAttributes?.id) continue;

		// backpacks -> iterate over contained items
		if (item.tag.ExtraAttributes.id.endsWith('BACKPACK')) {
			const _items = item.tag.ExtraAttributes[
				Object.keys(item.tag.ExtraAttributes).find((key) => key.endsWith('_data'))!
			] as NBTInventory;

			if (!Array.isArray(_items)) continue;

			for (const _item of _items) {
				if (!_item?.tag?.ExtraAttributes?.id) continue;

				networth += calculateItemPrice(_item);
			}

			continue;
		}

		// normal items
		networth += calculateItemPrice(item);
	}

	return networth;
}

/**
 * @param item
 */
function calculateItemPrice(item: NBTInventoryItem) {
	const ExtraAttributes = item.tag!.ExtraAttributes!;

	// pet item
	if (ExtraAttributes.petInfo) {
		return getPetPrice(JSON.parse(ExtraAttributes.petInfo as string) as Components.Schemas.SkyBlockProfilePet);
	}

	const itemId = ExtraAttributes.id;

	let price = getPrice(itemId) * item.Count;

	// dark auctions
	if (ExtraAttributes.winning_bid && itemId !== 'HEGEMONY_ARTIFACT') {
		price = ExtraAttributes.winning_bid as number;
	}

	// farming tools
	if (itemId.startsWith('THEORETICAL_HOE')) {
		const hoe = itemId.split('_');
		const level = Number(hoe.pop());

		// base price
		let tickets = 32;

		price = 1_000_000;

		// upgrades
		if (!Number.isNaN(level)) {
			// 256 + 256 * 144 ~= 256 * 144 -> only take materials for last upgrade stage into consideration
			price += 256 * getPrice(MATERIALS_TO_ID[hoe.pop() as keyof typeof MATERIALS_TO_ID]) * 144 ** (level - 1);

			switch (level) {
				case 3:
					tickets += 256;
				// fallthrough
				case 2:
					tickets += 64;
			}
		}

		price += getPrice('JACOBS_TICKET') * tickets;
	}

	// enchantments
	if (ExtraAttributes.enchantments) {
		if (itemId === 'ENCHANTED_BOOK') {
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

				if (itemId !== 'STONK_PICKAXE' && enchant === 'efficiency' && level > 5) {
					price += getPrice('SILEX');
				}

				price += getPrice(`${enchant}_${level}`);
			}
		}
	}

	// hot potato books + fuming potato books
	if (ExtraAttributes.hot_potato_count) {
		if (ExtraAttributes.hot_potato_count > 10) {
			price += getPrice('HOT_POTATO_BOOK') * 10;
			price += getPrice('FUMING_POTATO_BOOK') * (ExtraAttributes.hot_potato_count - 10);
		} else {
			price += getPrice('HOT_POTATO_BOOK') * ExtraAttributes.hot_potato_count;
		}
	}

	// art of war
	if (ExtraAttributes.art_of_war_count) {
		price += getPrice('THE_ART_OF_WAR') * (ExtraAttributes.art_of_war_count as number);
	}

	// farming for dummies
	if (ExtraAttributes.farming_for_dummies_count) {
		price += getPrice('FARMING_FOR_DUMMIES') * (ExtraAttributes.farming_for_dummies_count as number);
	}

	// dungeon stars
	if (ExtraAttributes.dungeon_item_level) {
		const essenceItem = ESSENCE_UPGRADES[itemId as keyof typeof ESSENCE_UPGRADES];

		if (essenceItem) {
			let essenceAmount = essenceItem.dungeonize;

			// normal stars (5 -> 1)
			for (let star = Math.min(ExtraAttributes.dungeon_item_level, 5); star > 0; --star) {
				essenceAmount += essenceItem[star as 1 | 2 | 3 | 4 | 5] ?? 0;
			}

			price += essenceAmount * ESSENCE_PRICES[essenceItem.type];

			// master stars (4 -> 0 cause array index)
			for (let star = ExtraAttributes.dungeon_item_level - 5; star-- >= 0; ) {
				price += getPrice(MASTER_STARS[star]);
			}
		} else {
			logger.warn(`[NETWORTH]: unknown dungeon item '${itemId}'`);
		}
	}

	// skin
	if (ExtraAttributes.skin) {
		price += getPrice(ExtraAttributes.skin as string) * 0.9;
	}

	// enrichments
	if (ExtraAttributes.talisman_enrichment) {
		price += getPrice(`TALISMAN_ENRICHMENT_${ExtraAttributes.talisman_enrichment}`);
	}

	// recombed
	if (
		ExtraAttributes.rarity_upgrades! > 0 &&
		ExtraAttributes.originTag &&
		(ExtraAttributes.enchantments || TALISMANS.has(itemId))
	) {
		price += getPrice('RECOMBOBULATOR_3000') / 2;
	}

	// gemstones
	if (ExtraAttributes.gems) {
		for (const [key, value] of Object.entries(ExtraAttributes.gems as unknown as Record<string, string>)) {
			if (IGNORED_GEMSTONES.has(key)) continue;

			const [slotType] = key.split('_', 1);

			if (SPECIAL_GEMSTONES.has(slotType)) {
				if (key.endsWith('_gem')) continue;

				price += getPrice(`${value}_${(ExtraAttributes.gems as unknown as Record<string, string>)[`${key}_gem`]}_GEM`);
			} else if (GEMSTONES.has(slotType)) {
				price += getPrice(`${value}_${slotType}_GEM`);
			} else {
				logger.warn(`[NETWORTH]: unknown gemstone '${key}: ${value}'`);
			}
		}
	}

	// wooden singularity
	if (ExtraAttributes.wood_singularity_count) {
		price += getPrice('WOOD_SINGULARITY');
	}

	// transmission tuners
	if (ExtraAttributes.tuned_transmission) {
		price += getPrice('TRANSMISSION_TUNER') * (ExtraAttributes.tuned_transmission as number);
	}

	// reforge
	if (ExtraAttributes.modifier && !TALISMANS.has(itemId)) {
		price += getPrice(REFORGES[ExtraAttributes.modifier as keyof typeof REFORGES]);
	}

	// scrolls (Necron's Blade)
	if (ExtraAttributes.ability_scroll) {
		for (const _item of Object.values(ExtraAttributes.ability_scroll as unknown as string[])) {
			price += getPrice(_item);
		}
	}

	// divan armor
	if (ExtraAttributes.gemstone_slots) {
		price += (ExtraAttributes.gemstone_slots as number) * getPrice('GEMSTONE_CHAMBER');
	}

	// drills
	if (ExtraAttributes.drill_part_upgrade_module) {
		price += getPrice((ExtraAttributes.drill_part_upgrade_module as string).toUpperCase());
	}
	if (ExtraAttributes.drill_part_fuel_tank) {
		price += getPrice((ExtraAttributes.drill_part_fuel_tank as string).toUpperCase());
	}
	if (ExtraAttributes.drill_part_engine) {
		price += getPrice((ExtraAttributes.drill_part_engine as string).toUpperCase());
	}

	// ethermerge (Aspect of the Void)
	if (ExtraAttributes.ethermerge) {
		price += getPrice('ETHERWARP_CONDUIT') + getPrice('ETHERWARP_MERGER');
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
	const lvl1 = prices.get(`LVL_1_${pet.tier}_${pet.type}`);
	const lvl100 = prices.get(`LVL_100_${pet.tier}_${pet.type}`);
	const lvl200 = prices.get(`LVL_200_${pet.tier}_${pet.type}`);
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
	if (pet.heldItem && level !== 200) {
		price += getPrice(pet.heldItem);
	}

	// candy + skins
	if (!pet.candyUsed) {
		if (pet.skin) {
			// no candy and skin
			price += getPrice(`PET_SKIN_${pet.skin}`) * 0.9;
		}
	} else {
		if (pet.type !== 'ENDER_DRAGON') {
			price = price / 1.538_232;
		}
		if (pet.skin) {
			// candy and skin
			price += getPrice(`PET_SKIN_${pet.skin}`) * 0.5;
		}
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
	let networth = (banking?.balance ?? ((bankingAPIEnabled = false), 0)) + (member.coin_purse ?? 0);

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
			networth += getPrice(index) * (count ?? 0);
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
