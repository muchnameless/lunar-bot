import { Buffer } from 'node:buffer';
import { parse, simplify } from 'prismarine-nbt';
import { logger } from '../../functions';
import { hypixel } from '../../api';
import {
	CRAFTING_RECIPES,
	ESSENCE_PRICES,
	ESSENCE_UPGRADES,
	GEMSTONES,
	IGNORED_GEMSTONES,
	ItemId,
	MASTER_STARS,
	MATERIALS_TO_ID,
	PriceModifier,
	REFORGES,
	SKYBLOCK_INVENTORIES,
	SPECIAL_GEMSTONES,
	TALISMANS,
} from './constants';
import { getPrice, prices } from './prices';
import { calculatePetSkillLevel, getEnchantment, isVanillaItem, transformItemData } from './functions';
import type { SkyBlockProfile } from '../../functions';
import type { Components, NBTExtraAttributes, NBTInventoryItem } from '@zikeji/hypixel';

/**
 * parse base64 item_data strings and calculate item prices
 * @param base64
 */
async function parseItems(base64: string) {
	let networth = 0;

	for (const item of await transformItemData(base64)) {
		if (!item?.tag?.ExtraAttributes?.id) continue;

		// backpacks -> iterate over contained items
		if (item.tag.ExtraAttributes.id.endsWith('BACKPACK')) {
			const _items = item.tag.ExtraAttributes[
				Object.keys(item.tag.ExtraAttributes).find((key) => key.endsWith('_data'))!
			] as number[];

			if (!Array.isArray(_items)) continue;

			for (const _item of simplify((await parse(Buffer.from(_items))).parsed.value.i as never) as NBTInventoryItem[]) {
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

type SkyBlockNBTExtraAttributes = NBTExtraAttributes &
	Partial<{
		ability_scroll: string[];
		art_of_war_count: number;
		drill_part_engine: string;
		drill_part_fuel_tank: string;
		drill_part_upgrade_module: string;
		ethermerge: number;
		farming_for_dummies_count: number;
		gems: Record<string, string>;
		gemstone_slots: number;
		modifier: keyof typeof REFORGES;
		petInfo: string;
		skin: string;
		talisman_enrichment: string;
		tuned_transmission: number;
		winning_bid: number;
		wood_singularity_count: number;
	}>;

/**
 * @param item
 */
export function calculateItemPrice(item: NBTInventoryItem) {
	// ignore vanilla items (common rarity and no lore)
	if (isVanillaItem(item)) return 0;

	const ExtraAttributes = item.tag!.ExtraAttributes as SkyBlockNBTExtraAttributes;

	// pet item
	if (ExtraAttributes.petInfo) {
		return getPetPrice(JSON.parse(ExtraAttributes.petInfo) as Components.Schemas.SkyBlockProfilePet);
	}

	const itemId = ExtraAttributes.id;

	let price =
		(prices.get(itemId) ??
			// non auctionable craftable items
			CRAFTING_RECIPES[itemId]?.reduce((acc, { id, count }) => acc + getPrice(id) * count, 0) ??
			// unknown item
			0) * item.Count;

	// dark auctions
	if (ExtraAttributes.winning_bid && itemId !== ItemId.HegemonyArtifact) {
		price = ExtraAttributes.winning_bid;
	}

	// farming tools
	if (itemId.startsWith(ItemId.TheoreticalHoe)) {
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

		price += getPrice(ItemId.JacobsTicket) * tickets;
	}

	// enchantments
	if (ExtraAttributes.enchantments) {
		let enchantmentPrice = 0;

		// eslint-disable-next-line prefer-const
		for (let [enchantment, level] of Object.entries(ExtraAttributes.enchantments)) {
			if (enchantment === 'efficiency' && level > 5) {
				if (itemId === ItemId.Stonk) continue;
				price += getPrice(ItemId.Silex) * PriceModifier.Silex * (level - 5);
				level = 5;
			}

			const { itemId: enchantmentId, count } = getEnchantment(enchantment, level);
			enchantmentPrice += getPrice(enchantmentId) * count;
		}

		if (itemId !== ItemId.EnchantedBook) enchantmentPrice *= PriceModifier.AppliedEnchantment;

		price += enchantmentPrice;
	}

	// runes
	if (ExtraAttributes.runes) {
		for (const [rune, level] of Object.entries(ExtraAttributes.runes)) {
			price += getPrice(`RUNE_${rune}_${level}`) * PriceModifier.Rune;
		}
	}

	// hot potato books + fuming potato books
	if (ExtraAttributes.hot_potato_count) {
		if (ExtraAttributes.hot_potato_count > 10) {
			price += getPrice(ItemId.HotPotatoBook) * PriceModifier.HotPotatoBook * 10;
			price +=
				getPrice(ItemId.FumingPotatoBook) * PriceModifier.FumingPotatoBook * (ExtraAttributes.hot_potato_count - 10);
		} else {
			price += getPrice(ItemId.HotPotatoBook) * PriceModifier.HotPotatoBook * ExtraAttributes.hot_potato_count;
		}
	}

	// art of war
	if (ExtraAttributes.art_of_war_count) {
		price += getPrice(ItemId.ArtOfWar) * PriceModifier.ArtOfWar * ExtraAttributes.art_of_war_count;
	}

	// farming for dummies
	if (ExtraAttributes.farming_for_dummies_count) {
		price +=
			getPrice(ItemId.FarmingForDummies) * PriceModifier.FarmingForDummies * ExtraAttributes.farming_for_dummies_count;
	}

	// dungeon stars
	if (ExtraAttributes.dungeon_item_level) {
		const essenceItem =
			ESSENCE_UPGRADES[itemId as keyof typeof ESSENCE_UPGRADES] ??
			// upgraded item fix p1: originTag (most of the time) shows the base version of upgraded items
			ESSENCE_UPGRADES[ExtraAttributes.originTag as keyof typeof ESSENCE_UPGRADES] ??
			// upgraded item fix p2: STARRED_BONZO_STAFF -> BONZO_STAFF
			ESSENCE_UPGRADES[itemId.slice(itemId.indexOf('_') + 1) as keyof typeof ESSENCE_UPGRADES] ??
			// upgraded item fix p3: PERFECT_HELMET_12 -> PERFECT_HELMET
			ESSENCE_UPGRADES[itemId.slice(0, itemId.lastIndexOf('_')) as keyof typeof ESSENCE_UPGRADES];

		if (essenceItem) {
			let essenceAmount = essenceItem.dungeonize;

			// normal stars (5 -> 1)
			for (let star = Math.min(ExtraAttributes.dungeon_item_level, 5); star > 0; --star) {
				essenceAmount += essenceItem[star as 1 | 2 | 3 | 4 | 5] ?? 0;
			}

			price += essenceAmount * (ESSENCE_PRICES[essenceItem.type] ?? 0) * PriceModifier.DungeonEssence;

			// master stars (4 -> 0 cause array index)
			for (let star = ExtraAttributes.dungeon_item_level - 5; star-- >= 0; ) {
				price += getPrice(MASTER_STARS[star]) * PriceModifier.DungeonStar;
			}
		} else {
			logger.warn(`[NETWORTH]: unknown dungeon item '${itemId}', originTag: '${ExtraAttributes.originTag}'`);
		}
	}

	// skin
	if (ExtraAttributes.skin) {
		price += getPrice(ExtraAttributes.skin) * PriceModifier.ItemSkin;
	}

	// enrichments
	if (ExtraAttributes.talisman_enrichment) {
		price += getPrice(`TALISMAN_ENRICHMENT_${ExtraAttributes.talisman_enrichment}`) * PriceModifier.TalismanEnrichment;
	}

	// recombed
	if (
		ExtraAttributes.rarity_upgrades! > 0 &&
		ExtraAttributes.originTag &&
		(ExtraAttributes.enchantments || TALISMANS.has(itemId))
	) {
		price += getPrice(ItemId.Recombobulator) * PriceModifier.Recomb;
	}

	// gemstones
	if (ExtraAttributes.gems) {
		for (const [key, value] of Object.entries(ExtraAttributes.gems)) {
			if (IGNORED_GEMSTONES.has(key)) continue;

			const [slotType] = key.split('_', 1);

			if (SPECIAL_GEMSTONES.has(slotType)) {
				if (key.endsWith('_gem')) continue;

				price += getPrice(`${value}_${ExtraAttributes.gems[`${key}_gem`]}_GEM`) * PriceModifier.Gemstone;
			} else if (GEMSTONES.has(slotType)) {
				price += getPrice(`${value}_${slotType}_GEM`) * PriceModifier.Gemstone;
			} else {
				logger.warn(`[NETWORTH]: unknown gemstone '${key}: ${value}'`);
			}
		}
	}

	// wooden singularity
	if (ExtraAttributes.wood_singularity_count) {
		price += getPrice(ItemId.WoodSingularity) * PriceModifier.WoodSingularity;
	}

	// transmission tuners
	if (ExtraAttributes.tuned_transmission) {
		price += getPrice(ItemId.TransmissionTuner) * PriceModifier.TransmissionTuner * ExtraAttributes.tuned_transmission;
	}

	// reforge
	if (ExtraAttributes.modifier && !TALISMANS.has(itemId)) {
		price += getPrice(REFORGES[ExtraAttributes.modifier]) * PriceModifier.Reforge;
	}

	// scrolls (Necron's Blade)
	if (ExtraAttributes.ability_scroll) {
		for (const _item of Object.values(ExtraAttributes.ability_scroll)) {
			price += getPrice(_item) * PriceModifier.NecronBladeScroll;
		}
	}

	// divan armor
	if (ExtraAttributes.gemstone_slots) {
		price += ExtraAttributes.gemstone_slots * getPrice(ItemId.GemstoneChamber) * PriceModifier.GemstoneChamber;
	}

	// drills
	if (ExtraAttributes.drill_part_upgrade_module) {
		price += getPrice(ExtraAttributes.drill_part_upgrade_module.toUpperCase()) * PriceModifier.DrillUpgrade;
	}
	if (ExtraAttributes.drill_part_fuel_tank) {
		price += getPrice(ExtraAttributes.drill_part_fuel_tank.toUpperCase()) * PriceModifier.DrillUpgrade;
	}
	if (ExtraAttributes.drill_part_engine) {
		price += getPrice(ExtraAttributes.drill_part_engine.toUpperCase()) * PriceModifier.DrillUpgrade;
	}

	// ethermerge (Aspect of the Void)
	if (ExtraAttributes.ethermerge) {
		price +=
			getPrice(ItemId.EtherwarpConduit) * PriceModifier.EtherwarpConduit +
			getPrice(ItemId.EtherwarpMerger) * PriceModifier.EtherwarpMerger;
	}

	return price;
}

/**
 * @param pet
 */
function getPetPrice(pet: Components.Schemas.SkyBlockProfilePet) {
	const { level, maxXP } = calculatePetSkillLevel(pet);

	let price: number;

	if (level < 100) {
		const LVL_1 = prices.get(`LVL_1_${pet.tier}_${pet.type}`);
		const LVL_100 = prices.get(`LVL_100_${pet.tier}_${pet.type}`);

		if (LVL_1 === undefined) {
			price = 0;
		} else if (LVL_100 === undefined || !maxXP) {
			price = LVL_1;
		} else {
			price = ((LVL_100 - LVL_1) / maxXP) * pet.exp + LVL_1;
		}
	} else if (level === 100) {
		price = prices.get(`LVL_100_${pet.tier}_${pet.type}`) ?? getPrice(`LVL_1_${pet.tier}_${pet.type}`);
	} else if (level < 200) {
		const LVL_100 = prices.get(`LVL_100_${pet.tier}_${pet.type}`);
		const LVL_200 = prices.get(`LVL_200_${pet.tier}_${pet.type}`);

		if (LVL_100 === undefined) {
			price = 0;
		} else if (LVL_200 === undefined) {
			price = LVL_100;
		} else {
			price = ((LVL_200 - LVL_100) / 100) * Number(level.toString().slice(1)) + LVL_100;
		}
	} else {
		price =
			prices.get(`LVL_200_${pet.tier}_${pet.type}`) ??
			prices.get(`LVL_100_${pet.tier}_${pet.type}`) ??
			getPrice(`LVL_1_${pet.tier}_${pet.type}`);
	}

	// held item
	if (pet.heldItem && level !== 200) {
		price += getPrice(pet.heldItem) * PriceModifier.PetItem;
	}

	// candy + skins
	if (!pet.candyUsed) {
		if (pet.skin) {
			// no candy and skin
			price += getPrice(`PET_SKIN_${pet.skin}`) * PriceModifier.PetSkinNoCandy;
		}
	} else {
		if (pet.type !== ItemId.EnderDragon) {
			price *= PriceModifier.PetWithCandy;
		}
		if (pet.skin) {
			// candy and skin
			price += getPrice(`PET_SKIN_${pet.skin}`) * PriceModifier.PetSkinWithCandy;
		}
	}

	return price;
}

/**
 * @param profileId
 * @param uuid
 */
export async function getAuctionNetworth(profileId: string, uuid?: string) {
	const auctions = await hypixel.skyblock.auction.profile(profileId);

	if (!auctions.length) return 0;

	const promises: Promise<number>[] = [];

	let collectableBids = 0;

	for (const auction of auctions) {
		if (auction.claimed || auction.auctioneer !== uuid) continue;

		if (auction.end < Date.now()) {
			collectableBids += auction.highest_bid_amount;
		} else {
			promises.push(parseItems(auction.item_bytes.data));
		}
	}

	if (!promises.length) return collectableBids;

	return collectableBids + (await Promise.all(promises)).reduce((a, b) => a + b);
}

/**
 * @param profile
 * @param uuid
 * @param options
 */
export async function getNetworth(
	{ banking, members, profile_id: profileId }: SkyBlockProfile,
	uuid: string,
	{ addBanking = true, addAuctions = false } = {},
) {
	const member = members[uuid];

	let bankingAPIEnabled = true;
	let networth = (addBanking ? banking?.balance ?? ((bankingAPIEnabled = false), 0) : 0) + (member.coin_purse ?? 0);

	const promises: Promise<number>[] = [];

	if (addAuctions) {
		promises.push(getAuctionNetworth(profileId, uuid));
	}

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

	if (member.backpack_icons) {
		for (const backpack of Object.values(member.backpack_icons)) {
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
