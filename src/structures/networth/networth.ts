import { transformItemData } from '@zikeji/hypixel';
import {
	ALLOWED_ENCHANTS,
	BLOCKED_ENCHANTS,
	GEMSTONES,
	IGNORED_GEMSTONES,
	MASTER_STARS,
	PET_LEVELS_XP,
	PET_RARITY_OFFSET,
	reforges,
	SKYBLOCK_INVENTORIES,
	SPECIAL_GEMSTONES,
	TALISMANS,
} from './constants';
import { prices } from './prices';
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
	let price = (prices.get(itemId) ?? 0) * item.Count;

	if (ExtraAttributes.winning_bid && !itemId.includes('hegemony')) {
		price = ExtraAttributes.winning_bid as number;
	}

	if (itemId == 'enchanted_book' && ExtraAttributes.enchantments) {
		const enchants = Object.keys(ExtraAttributes.enchantments);

		if (enchants.length == 1) {
			const value = ExtraAttributes.enchantments[enchants[0]];

			price = prices.get(`${enchants[0]}_${value}`) ?? 0;
		}
	}

	if (ExtraAttributes.enchantments && itemId != 'enchanted_book') {
		for (const enchant of Object.entries(ExtraAttributes.enchantments)) {
			if (BLOCKED_ENCHANTS[itemId as keyof typeof BLOCKED_ENCHANTS]?.has(enchant[0])) continue;

			if (ALLOWED_ENCHANTS.has(enchant[0])) {
				price += prices.get(`${enchant[0]}_${enchant[1]}`) ?? 0;
			}
		}
	}

	if (
		(ExtraAttributes.rarity_upgrades ?? 0) > 0 &&
		ExtraAttributes.originTag &&
		(ExtraAttributes.enchantments || TALISMANS.has(itemId))
	) {
		price += prices.get('recombobulator_3000') ?? 0 / 2;
	}

	if (ExtraAttributes.gems) {
		for (const [key, value] of Object.entries(ExtraAttributes.gems as unknown as Record<string, string>)) {
			if (IGNORED_GEMSTONES.has(key)) continue;

			const [slotType] = key.split('_', 2);

			if (SPECIAL_GEMSTONES.has(slotType)) {
				price +=
					prices.get(
						`${value}_${(ExtraAttributes.gems as unknown as Record<string, string>)[`${key}_gem`]}_gem`.toLowerCase(),
					) ?? 0;
			} else if (GEMSTONES.has(slotType)) {
				price += prices.get(`${value}_${key.split('_', 2)[0]}_gem`.toLowerCase()) ?? 0;
			}
		}
	}

	if (ExtraAttributes.modifier && !TALISMANS.has(itemId)) {
		price += prices.get(reforges[ExtraAttributes.modifier as keyof typeof reforges]) ?? 0;
	}

	if (ExtraAttributes.dungeon_item_level! > 5) {
		for (let star = ExtraAttributes.dungeon_item_level! - 5; star--; ) {
			price += prices.get(MASTER_STARS[star]) ?? 0;
		}
	}

	if (ExtraAttributes.ability_scroll) {
		for (const _item of Object.values(ExtraAttributes.ability_scroll as unknown as string[])) {
			price += prices.get(_item.toLowerCase()) ?? 0;
		}
	}

	if (ExtraAttributes.gemstone_slots) {
		price += (ExtraAttributes.gemstone_slots as number) * (prices.get('gemstone_chamber') ?? 0);
	}

	if (ExtraAttributes.drill_part_upgrade_module) {
		price += prices.get(ExtraAttributes.drill_part_upgrade_module as string) ?? 0;
	}

	if (ExtraAttributes.drill_part_fuel_tank) {
		price += prices.get(ExtraAttributes.drill_part_fuel_tank as string) ?? 0;
	}

	if (ExtraAttributes.drill_part_engine) {
		price += prices.get(ExtraAttributes.drill_part_engine as string) ?? 0;
	}

	if (ExtraAttributes.ethermerge! > 0) {
		price += prices.get('etherwarp_conduit') ?? 0;
	}

	return price;
}

/**
 * @param pet
 */
export function calculatePetSkillLevel(pet: Components.Schemas.SkyBlockProfilePet) {
	const maxLevel = pet.type == 'GOLDEN_DRAGON' ? 200 : 100;
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

	if (lvl1 == undefined || lvl100 == undefined) return 0;

	const { level, maxXP } = calculatePetSkillLevel(pet);

	let price = lvl200 ?? lvl100;

	if (level < 100 && maxXP) {
		price = ((lvl100 - lvl1) / maxXP) * pet.exp + lvl1;
	}

	if (level > 100 && level < 200) {
		price = ((lvl200! - lvl100) / 100) * Number(level.toString().slice(1)) + lvl100;
	}

	if (pet.heldItem && level != 200) {
		price += prices.get(pet.heldItem.toLowerCase()) ?? 0;
	}

	if (pet.candyUsed! > 0 && pet.type != 'ENDER_DRAGON') {
		price = price / 1.538_232;
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
			networth += (prices.get(index.toLowerCase()) ?? 0) * (count ?? 0);
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
