import { Buffer } from 'node:buffer';
import { parse, simplify } from 'prismarine-nbt';
import { logger } from '../../logger';
import { hypixel } from '../../api';
import {
	BLOCKED_ENCHANTS,
	CRAFTING_RECIPES,
	Enchantment,
	ItemId,
	MASTER_STARS,
	MATERIALS_TO_ID,
	PriceModifier,
	REDUCED_VALUE_ENCHANTS,
	REFORGES,
	SKYBLOCK_INVENTORIES,
} from './constants';
import { accessories, getPrice, itemUpgrades, prices } from './prices';
import {
	calculatePetSkillLevel,
	getEnchantment,
	getUpgradeMaterialPrice,
	isVanillaItem,
	transformItemData,
} from './functions';
import type { SkyBlockProfile } from '../../functions';
import type { Components, NBTExtraAttributes, NBTInventoryItem } from '@zikeji/hypixel';

/**
 * parse base64 item_data strings and calculate item prices
 * @param base64
 */
async function parseItems(base64: string) {
	let networth = 0;

	for (const item of await transformItemData(base64)) {
		if (!item.tag?.ExtraAttributes?.id) continue;

		// backpacks / new year cake bag -> iterate over contained items
		if (item.tag.ExtraAttributes.id.endsWith('BACKPACK') || item.tag.ExtraAttributes.id.endsWith('_BAG')) {
			const _items = item.tag.ExtraAttributes[
				Object.keys(item.tag.ExtraAttributes).find((key) => key.endsWith('_data'))!
			] as number[];

			if (!Array.isArray(_items)) continue;

			for (const _item of simplify(
				(await parse(Buffer.from(_items), 'big')).parsed.value.i as never,
			) as NBTInventoryItem[]) {
				if (!_item.tag?.ExtraAttributes?.id) continue;

				networth += calculateItemPrice(_item);
			}

			continue;
		}

		// normal items
		networth += calculateItemPrice(item);
	}

	return networth;
}

export type SkyBlockNBTExtraAttributes = NBTExtraAttributes &
	Partial<{
		ability_scroll: string[];
		art_of_war_count: number;
		drill_part_engine: string;
		drill_part_fuel_tank: string;
		drill_part_upgrade_module: string;
		dye_item: string;
		ethermerge: number;
		farming_for_dummies_count: number;
		gems: Record<string, string>;
		gemstone_slots: number;
		modifier: keyof typeof REFORGES;
		petInfo: string;
		skin: string;
		talisman_enrichment: string;
		tuned_transmission: number;
		upgrade_level: number;
		winning_bid: number;
		wood_singularity_count: number;
	}>;

/**
 * @param item
 */
export function calculateItemPrice(item: NBTInventoryItem) {
	const extraAttributes = item.tag!.ExtraAttributes as SkyBlockNBTExtraAttributes;

	// pet item
	if (extraAttributes.petInfo) {
		return getPetPrice(JSON.parse(extraAttributes.petInfo) as Components.Schemas.SkyBlockProfilePet);
	}

	// ignore vanilla items (they are not worth much and tend to be binned for way to high / sold for coin transfers)
	if (isVanillaItem(item)) return 0;

	const itemId = extraAttributes.id;

	let price =
		(prices.get(itemId) ??
			// non auctionable craftable items
			CRAFTING_RECIPES[itemId]?.reduce((acc, { id, count }) => acc + getPrice(id) * count, 0) ??
			// unknown item
			0) * item.Count;

	// dark auctions
	if (extraAttributes.winning_bid && itemId !== ItemId.HegemonyArtifact) {
		price = extraAttributes.winning_bid;
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
	if (extraAttributes.enchantments) {
		// eslint-disable-next-line prefer-const
		for (let [enchantment, level] of Object.entries(extraAttributes.enchantments)) {
			if (BLOCKED_ENCHANTS[itemId as keyof typeof BLOCKED_ENCHANTS]?.includes(enchantment as any)) continue;

			let enchantmentPrice = 0;

			if (enchantment === Enchantment.Efficiency && level > 5) {
				if (itemId === ItemId.Stonk) continue;
				price += getPrice(ItemId.Silex) * PriceModifier.Silex * (level - 5);
				level = 5;
			}

			const { itemId: enchantmentId, count, higherBaseLvls } = getEnchantment(enchantment as Enchantment, level);

			enchantmentPrice = higherBaseLvls
				? Math.min(
						getPrice(enchantmentId) * count,
						...higherBaseLvls.map((higherEnchantment) => getPrice(higherEnchantment)),
				  )
				: getPrice(enchantmentId) * count;

			// applied enchantments are worth less
			if (itemId !== ItemId.EnchantedBook) {
				enchantmentPrice *= PriceModifier.AppliedEnchantment;

				if (REDUCED_VALUE_ENCHANTS.has(enchantment)) enchantmentPrice *= PriceModifier.AppliedEnchantmentReduced;
			}

			price += enchantmentPrice;
		}
	}

	// runes
	if (extraAttributes.runes) {
		for (const [rune, level] of Object.entries(extraAttributes.runes)) {
			price += getPrice(`RUNE_${rune}_${level}`) * PriceModifier.Rune;
		}
	}

	// hot potato books + fuming potato books
	if (extraAttributes.hot_potato_count) {
		if (extraAttributes.hot_potato_count > 10) {
			price += getPrice(ItemId.HotPotatoBook) * PriceModifier.HotPotatoBook * 10;
			price +=
				getPrice(ItemId.FumingPotatoBook) * PriceModifier.FumingPotatoBook * (extraAttributes.hot_potato_count - 10);
		} else {
			price += getPrice(ItemId.HotPotatoBook) * PriceModifier.HotPotatoBook * extraAttributes.hot_potato_count;
		}
	}

	// dyes
	if (extraAttributes.dye_item) {
		price += getPrice(extraAttributes.dye_item) * PriceModifier.Dye;
	}

	// art of war
	if (extraAttributes.art_of_war_count) {
		price += getPrice(ItemId.ArtOfWar) * PriceModifier.ArtOfWar * extraAttributes.art_of_war_count;
	}

	// farming for dummies
	if (extraAttributes.farming_for_dummies_count) {
		price +=
			getPrice(ItemId.FarmingForDummies) * PriceModifier.FarmingForDummies * extraAttributes.farming_for_dummies_count;
	}

	// stars
	// upgrade_level seems to be the newer key, if both are present it's always higher than dungeon_item_level
	const stars = extraAttributes.upgrade_level ?? extraAttributes.dungeon_item_level;

	if (typeof stars === 'number') {
		const itemUpgrade = itemUpgrades.get(itemId);

		if (itemUpgrade) {
			let essencePrice = 0;

			// initial dungeon conversion cost
			if (itemUpgrade.dungeon_conversion) {
				for (const [material, amount] of Object.entries(itemUpgrade.dungeon_conversion)) {
					essencePrice += getUpgradeMaterialPrice(material) * amount;
				}
			}

			// stars
			for (let star = stars - 1; star >= 0; --star) {
				// item api has required materials
				if (itemUpgrade.stars[star]) {
					for (const [material, amount] of Object.entries(itemUpgrade.stars[star])) {
						essencePrice += getUpgradeMaterialPrice(material) * amount;
					}
				} else {
					// dungeon items require master stars for stars 6 - 10
					price += getPrice(MASTER_STARS[star - 5]) * PriceModifier.DungeonMasterStar;
				}
			}

			price += essencePrice * PriceModifier.Essence;
		} else {
			logger.warn(`[NETWORTH]: unknown starred item '${itemId}', originTag: '${extraAttributes.originTag}'`);
		}
	}

	// skin
	if (extraAttributes.skin) {
		price += getPrice(extraAttributes.skin) * PriceModifier.ItemSkin;
	}

	// enrichments
	if (extraAttributes.talisman_enrichment) {
		price += getPrice(`TALISMAN_ENRICHMENT_${extraAttributes.talisman_enrichment}`) * PriceModifier.TalismanEnrichment;
	}

	// recombed
	if (
		extraAttributes.rarity_upgrades! > 0 &&
		extraAttributes.originTag &&
		(extraAttributes.enchantments || accessories.has(itemId))
	) {
		price += getPrice(ItemId.Recombobulator) * PriceModifier.Recomb;
	}

	// gemstones
	if (extraAttributes.gems) {
		/**
		 * API example:
		 *
		 * gems: {
		 *   AMBER_0: 'FINE',                // FINE_AMBER (slice '_')
		 *   AMBER_1: 'FLAWLESS',            // FLAWLESS_AMBER (slice '_')
		 *   COMBAT_0: 'FINE',               // COMBAT_0_gem (gems[`${key}_gem`])
		 *   COMBAT_0_gem: 'JASPER',         // endsWith('_gem') continue
		 *   unlocked_slots: [ 'COMBAT_0' ], // isArray continue
		 * }
		 */
		for (const [key, value] of Object.entries(extraAttributes.gems)) {
			if (Array.isArray(value) || key.endsWith('_gem')) continue;

			price +=
				getPrice(`${value}_${extraAttributes.gems[`${key}_gem`] ?? key.slice(0, key.indexOf('_'))}_GEM`) *
				PriceModifier.Gemstone;
		}
	}

	// wooden singularity
	if (extraAttributes.wood_singularity_count) {
		price += getPrice(ItemId.WoodSingularity) * PriceModifier.WoodSingularity;
	}

	// transmission tuners
	if (extraAttributes.tuned_transmission) {
		price += getPrice(ItemId.TransmissionTuner) * PriceModifier.TransmissionTuner * extraAttributes.tuned_transmission;
	}

	// reforge
	if (extraAttributes.modifier && !accessories.has(itemId)) {
		price += getPrice(REFORGES[extraAttributes.modifier]) * PriceModifier.Reforge;
	}

	// scrolls (Necron's Blade)
	if (extraAttributes.ability_scroll) {
		for (const _item of Object.values(extraAttributes.ability_scroll)) {
			price += getPrice(_item) * PriceModifier.NecronBladeScroll;
		}
	}

	// divan armor
	if (extraAttributes.gemstone_slots) {
		price += extraAttributes.gemstone_slots * getPrice(ItemId.GemstoneChamber) * PriceModifier.GemstoneChamber;
	}

	// drills
	if (extraAttributes.drill_part_upgrade_module) {
		price += getPrice(extraAttributes.drill_part_upgrade_module.toUpperCase()) * PriceModifier.DrillUpgrade;
	}
	if (extraAttributes.drill_part_fuel_tank) {
		price += getPrice(extraAttributes.drill_part_fuel_tank.toUpperCase()) * PriceModifier.DrillUpgrade;
	}
	if (extraAttributes.drill_part_engine) {
		price += getPrice(extraAttributes.drill_part_engine.toUpperCase()) * PriceModifier.DrillUpgrade;
	}

	// ethermerge (Aspect of the Void)
	if (extraAttributes.ethermerge) {
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
		if (![ItemId.EnderDragon, ItemId.GoldenDragon].includes(pet.type as ItemId)) {
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
 * networth of a single running auction
 * @param auction
 */
const getRunningAuctionWorth = async (auction: Components.Schemas.SkyBlockAuctionResponse['auctions'][0]) => {
	const itemPrice = await parseItems(auction.item_bytes.data);

	// BIN? -> min(price, BIN price)
	// regular auction -> max(price, highest bid)
	return auction.bin ? Math.min(itemPrice, auction.starting_bid) : Math.max(itemPrice, auction.highest_bid_amount);
};

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
		// player already claimed the money or is not the seller
		if (auction.claimed || auction.auctioneer !== uuid) continue;

		if (auction.end < Date.now()) {
			// auction ended
			if (auction.highest_bid_amount) {
				// sold
				collectableBids += auction.highest_bid_amount;
			} else {
				// expired
				promises.push(parseItems(auction.item_bytes.data));
			}
		} else {
			// ongoing auction
			promises.push(getRunningAuctionWorth(auction));
		}
	}

	return (await Promise.all(promises)).reduce((acc, cur) => acc + cur, collectableBids);
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

	// banking
	let bankingAPIEnabled = true;
	let networth =
		// co-op bank
		(addBanking ? banking?.balance ?? ((bankingAPIEnabled = false), 0) : 0) +
		// purse
		(member.coin_purse ?? 0) +
		// personal bank
		(member.bank_account ?? 0);

	const promises: Promise<number>[] = [];

	// auctions
	if (addAuctions) {
		promises.push(getAuctionNetworth(profileId, uuid));
	}

	// inventories
	let inventoryAPIEnabled = true;

	for (const inventory of SKYBLOCK_INVENTORIES) {
		const data = member[inventory]?.data;

		if (!data) {
			if (inventory === 'inv_contents') inventoryAPIEnabled = false;
			continue;
		}

		promises.push(parseItems(data));
	}

	// backpacks
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

	// sacks
	if (member.sacks_counts) {
		for (const [index, count] of Object.entries(member.sacks_counts)) {
			networth += getPrice(index) * (count ?? 0);
		}
	}

	// pets
	if (member.pets) {
		for (const pet of member.pets) {
			networth += getPetPrice(pet);
		}
	}

	return {
		networth: (await Promise.all(promises)).reduce((acc, cur) => acc + cur, networth),
		bankingAPIEnabled,
		inventoryAPIEnabled,
	};
}
