import { Buffer } from 'node:buffer';
import { type Components, type NBTExtraAttributes, type NBTInventoryItem } from '@zikeji/hypixel';
import { parse, simplify } from 'prismarine-nbt';
import {
	ALLOWED_RECOMB_CATEGORIES,
	ALLOWED_RECOMB_ITEMS,
	ATTRIBUTES_BASE,
	CRAFTING_RECIPES,
	Enchantment,
	ITEM_SPECIFIC_IGNORED_ENCHANTS,
	ItemCategory,
	ItemId,
	MASTER_STARS,
	NON_REDUCED_PETS,
	PriceModifier,
	SKYBLOCK_INVENTORIES,
	THUNDER_CHARGES,
} from './constants/index.js';
import {
	calculatePetSkillLevel,
	getAppliedEnchantmentModifier,
	getEnchantment,
	getReforgeStone,
	isVanillaItem,
	transformItemData,
} from './functions/index.js';
import { getPrice, prices, skyblockItems, unknownItemIdWarnings, type SkyBlockItem } from './prices.js';
import { hypixel } from '#api';
import { logger } from '#logger';
import { Warnings } from '#structures/Warnings.js';

const unknownStarredItemWarnings = new Warnings<string>();

/**
 * parse base64 item_data strings and calculate item prices
 *
 * @param base64
 */
async function parseItems(base64: string) {
	let networth = 0;

	for (const item of await transformItemData(base64)) {
		if (!item.tag?.ExtraAttributes?.id) continue;

		// backpacks / new year cake bag -> iterate over contained items
		if (item.tag.ExtraAttributes.id.endsWith('_BACKPACK') || item.tag.ExtraAttributes.id.endsWith('_BAG')) {
			const items = item.tag.ExtraAttributes[
				Object.keys(item.tag.ExtraAttributes).find((key) => key.endsWith('_data'))!
			] as number[];

			if (!Array.isArray(items)) continue;

			for (const item of simplify(
				(await parse(Buffer.from(items), 'big')).parsed.value.i as never,
			) as NBTInventoryItem[]) {
				if (item.tag?.ExtraAttributes?.id) networth += calculateItemPrice(item);
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
		artOfPeaceApplied: number;
		art_of_war_count: number;
		drill_part_engine: string;
		drill_part_fuel_tank: string;
		drill_part_upgrade_module: string;
		dye_item: string;
		ethermerge: number;
		farming_for_dummies_count: number;
		gems: Record<string, string | { quality: string; uuid: string }> & { unlocked_slots?: string[] };
		gemstone_slots: number;
		jalapeno_count: number;
		mana_disintegrator_count: number;
		modifier: string;
		new_years_cake: number;
		price: number[];
		skin: string;
		stats_book: number;
		talisman_enrichment: string;
		thunder_charge: number;
		tuned_transmission: number;
		upgrade_level: number;
		winning_bid: number;
		wood_singularity_count: number;
	}>;

/**
 * https://hypixel-skyblock.fandom.com/wiki/Shen%27s_Auction
 *
 * @param extraAttributes
 */
const getShensAuctionPrice = (extraAttributes: SkyBlockNBTExtraAttributes) => {
	if (!extraAttributes.price) return null;

	// price is an array of [0, price] for some reason
	const paid = extraAttributes.price[1]!;

	// handle int overflows
	const price = (paid > 0 ? paid : 2 * 2_147_483_648 + paid) * PriceModifier.ShensAuction;

	if (Number.isNaN(price)) {
		logger.error({ extraAttributes }, '[GET SHENS AUCTION PRICE]: NaN');
		return null;
	}

	return price;
};

/**
 * @param item
 */
export function calculateItemPrice(item: NBTInventoryItem) {
	const extraAttributes = item.tag!.ExtraAttributes as SkyBlockNBTExtraAttributes;

	// pet item
	if (extraAttributes.petInfo) {
		return getPetPrice(JSON.parse(extraAttributes.petInfo) as Components.Schemas.SkyBlockProfilePet);
	}

	// new year cake item
	if (extraAttributes.new_years_cake) {
		return getPrice(`${ItemId.NewYearCake}_${extraAttributes.new_years_cake}`);
	}

	// ignore vanilla items (they are not worth much and tend to be binned for way to high / sold for coin transfers)
	if (isVanillaItem(item)) return 0;

	const itemId = extraAttributes.id;
	const skyblockItem = skyblockItems.get(itemId);

	let price =
		item.Count *
		(prices.get(itemId) ??
			// non auctionable craftable items
			CRAFTING_RECIPES[itemId]?.reduce((acc, { id, count }) => acc + count * getPrice(id), 0) ??
			// shen's auction items
			getShensAuctionPrice(extraAttributes) ??
			// unknown item
			(unknownItemIdWarnings.emit(itemId, { itemId }, '[GET PRICE]: unknown item'), 0));

	// dark auction items
	if (extraAttributes.winning_bid) {
		switch (itemId) {
			case ItemId.HegemonyArtifact:
				// price paid does not affect item
				break;

			case ItemId.MidasStaff:
				// price paid over 100M does not further affect item
				price = Math.min(extraAttributes.winning_bid, 100e6) * PriceModifier.WinningBid;
				break;

			case ItemId.MidasSword:
				// price paid over 50M does not further affect item
				price = Math.min(extraAttributes.winning_bid, 50e6) * PriceModifier.WinningBid;
				break;

			default:
				price = extraAttributes.winning_bid * PriceModifier.WinningBid;
		}
	}

	// enchantments
	if (extraAttributes.enchantments) {
		for (let [enchantment, level] of Object.entries(extraAttributes.enchantments) as [Enchantment, number][]) {
			// handle API inconsistencies with e.g. 'PROSECUTE'
			enchantment = enchantment.toLowerCase() as Enchantment;

			if (ITEM_SPECIFIC_IGNORED_ENCHANTS[itemId as keyof typeof ITEM_SPECIFIC_IGNORED_ENCHANTS]?.has(enchantment)) {
				continue;
			}

			if (enchantment === Enchantment.Efficiency && level > 5) {
				// Stonk has efficiency 6 by default, for other items 5 is the max level without Silex
				const isStonk = itemId === ItemId.Stonk;
				price += (level - (isStonk ? 6 : 5)) * getPrice(ItemId.Silex) * PriceModifier.Silex;
				if (isStonk) continue;
				level = 5;
			}

			const { itemId: enchantmentId, count } = getEnchantment(enchantment, level);

			let enchantmentPrice = count * getPrice(enchantmentId);

			// applied enchantments are worth less
			if (itemId !== ItemId.EnchantedBook) {
				enchantmentPrice *= getAppliedEnchantmentModifier(enchantment);
			}

			price += enchantmentPrice;
		}
	}

	// runes
	if (extraAttributes.runes) {
		for (const [rune, level] of Object.entries(extraAttributes.runes)) {
			price += getPrice(`${ItemId.Rune}_${rune}_${level}`) * PriceModifier.Rune;
		}
	}

	// dyes
	if (extraAttributes.dye_item) {
		price += getPrice(extraAttributes.dye_item) * PriceModifier.Dye;
	}

	// hot potato books + fuming potato books
	if (extraAttributes.hot_potato_count) {
		if (extraAttributes.hot_potato_count > 10) {
			price += 10 * getPrice(ItemId.HotPotatoBook) * PriceModifier.HotPotatoBook;
			price +=
				(extraAttributes.hot_potato_count - 10) * getPrice(ItemId.FumingPotatoBook) * PriceModifier.FumingPotatoBook;
		} else {
			price += extraAttributes.hot_potato_count * getPrice(ItemId.HotPotatoBook) * PriceModifier.HotPotatoBook;
		}
	}

	// book of stats, if applied stats_books is the number of kills, can be zero
	if (typeof extraAttributes.stats_book === 'number') {
		price += getPrice(ItemId.BookOfStats) * PriceModifier.BookOfStats;
	}

	// art of war
	if (extraAttributes.art_of_war_count) {
		price += extraAttributes.art_of_war_count * getPrice(ItemId.ArtOfWar) * PriceModifier.ArtOfWar;
	}

	// art of peace
	if (extraAttributes.artOfPeaceApplied) {
		price += extraAttributes.artOfPeaceApplied * getPrice(ItemId.ArtOfPeace) * PriceModifier.ArtOfPeace;
	}

	// farming for dummies
	if (extraAttributes.farming_for_dummies_count) {
		price +=
			extraAttributes.farming_for_dummies_count * getPrice(ItemId.FarmingForDummies) * PriceModifier.FarmingForDummies;
	}

	// upgradable armor (e.g. crimson)
	if (skyblockItem?.prestige) {
		let currentItemUpgrade: SkyBlockItem | undefined = skyblockItem;

		// follow prestige chain
		do {
			// stars
			if (skyblockItem.stars) {
				for (const star of skyblockItem.stars) {
					for (const [material, amount] of Object.entries(star)) {
						price += amount * getPrice(material) * PriceModifier.Essence;
					}
				}
			}

			// prestige
			for (const [material, amount] of Object.entries(skyblockItem.prestige.costs)) {
				price += amount * getPrice(material) * PriceModifier.Essence;
			}

			// try to add "base item"
			price += getPrice(currentItemUpgrade.prestige!.item) * PriceModifier.PrestigeItem;

			currentItemUpgrade = skyblockItems.get(currentItemUpgrade.prestige!.item);
		} while (currentItemUpgrade?.prestige);
	}

	// stars
	// upgrade_level seems to be the newer key, if both are present it's always higher than dungeon_item_level
	const stars = extraAttributes.upgrade_level ?? extraAttributes.dungeon_item_level;

	if (typeof stars === 'number') {
		if (skyblockItem) {
			// initial dungeon conversion cost
			if (skyblockItem.dungeon_conversion) {
				for (const [material, amount] of Object.entries(skyblockItem.dungeon_conversion)) {
					price += amount * getPrice(material) * PriceModifier.Essence;
				}
			}

			// stars
			if (skyblockItem.stars) {
				for (let star = stars - 1; star >= 0; --star) {
					// item api has required materials
					if (skyblockItem.stars[star]) {
						for (const [material, amount] of Object.entries(skyblockItem.stars[star]!)) {
							price += amount * getPrice(material) * PriceModifier.Essence;
						}
					} else {
						// dungeon items require master stars for stars 6 - 10
						price += getPrice(MASTER_STARS[star - 5]!) * PriceModifier.DungeonMasterStar;
					}
				}
			}
		} else {
			unknownStarredItemWarnings.emit(
				itemId,
				{ itemId, originTag: extraAttributes.originTag },
				'[NETWORTH]: unknown starred item',
			);
		}
	}

	// skin
	if (extraAttributes.skin) {
		price += getPrice(extraAttributes.skin) * PriceModifier.ItemSkin;
	}

	// enrichments
	if (extraAttributes.talisman_enrichment) {
		price +=
			getPrice(`TALISMAN_ENRICHMENT_${extraAttributes.talisman_enrichment.toUpperCase()}`) *
			PriceModifier.TalismanEnrichment;
	}

	// pulse ring
	if (extraAttributes.thunder_charge && itemId === ItemId.PulseRing) {
		price +=
			((THUNDER_CHARGES.findLast((charge) => charge <= extraAttributes.thunder_charge!) ?? 0) / 50_000) *
			getPrice(ItemId.ThunderInABottle) *
			PriceModifier.ThunderInABottle;
	}

	// recombed
	if (
		extraAttributes.rarity_upgrades! > 0 &&
		!extraAttributes.item_tier &&
		(extraAttributes.enchantments ||
			ALLOWED_RECOMB_CATEGORIES.has(skyblockItem?.category as any) ||
			ALLOWED_RECOMB_ITEMS.has(itemId as any))
	) {
		price += getPrice(ItemId.Recombobulator) * PriceModifier.Recomb;
	}

	// gemstones -- https://github.com/HypixelDev/PublicAPI/discussions/549
	if (extraAttributes.gems && skyblockItem?.gemstone_slots) {
		/**
		 * API example:
		 *
		 * gems: {
		 *   AMBER_0: 'FINE',
		 *   AMBER_1: 'FLAWLESS',
		 *   COMBAT_0: 'FINE',
		 *   COMBAT_0_gem: 'JASPER',
		 *   unlocked_slots: [ 'COMBAT_0' ],
		 * }
		 */
		const appliedGemstones = Object.entries(extraAttributes.gems);

		// iterate over all possible gemstone slots
		for (const { costs, slot_type } of skyblockItem.gemstone_slots) {
			// check whether gemstone is applied
			const keyIndex = appliedGemstones.findIndex(([key]) => key.startsWith(slot_type) && !key.endsWith('_gem'));
			if (keyIndex === -1) continue;

			// remove applied gemstone to not count the same one twice
			const [[key, value]] = appliedGemstones.splice(keyIndex, 1) as [
				// quality string has been changed to an object with the uuid but not all items are updated (yet?)
				[string, string | { quality: string; uuid: string }],
			];

			price +=
				getPrice(
					`${typeof value === 'string' ? value : value.quality}_${extraAttributes.gems[`${key}_gem`] ?? slot_type}_GEM`,
				) * PriceModifier.Gemstone;

			// additional unlocking costs for the slot
			if (costs && (extraAttributes.gems.unlocked_slots?.includes(key) ?? true)) {
				for (const [material, amount] of Object.entries(costs)) {
					price += amount * getPrice(material) * PriceModifier.GemstoneSlots;
				}
			}
		}
	}

	// attributes
	if (extraAttributes.attributes) {
		const basePrice =
			itemId in ATTRIBUTES_BASE ? getPrice(ATTRIBUTES_BASE[itemId as keyof typeof ATTRIBUTES_BASE]) : null;
		const isShard = itemId === ItemId.AttributeShard;

		for (const [attribute, tier] of Object.entries(extraAttributes.attributes)) {
			// items start with tier 1
			if (tier === 1 && !isShard) continue;

			let baseAttributePrice = getPrice(`${ItemId.AttributeShard}_${attribute}`);

			// can also use the same item instead of a shard to upgrade an attribute
			if (basePrice !== null) {
				baseAttributePrice = Math.min(baseAttributePrice, basePrice);
			}

			// -1 because items start with 1
			price += baseAttributePrice * (2 ** (tier - 1) - (isShard ? 0 : 1)) * PriceModifier.Attributes;
		}
	}

	// wood singularity
	if (extraAttributes.wood_singularity_count) {
		price += extraAttributes.wood_singularity_count * getPrice(ItemId.WoodSingularity) * PriceModifier.WoodSingularity;
	}

	// transmission tuners
	if (extraAttributes.tuned_transmission) {
		price += extraAttributes.tuned_transmission * getPrice(ItemId.TransmissionTuner) * PriceModifier.TransmissionTuner;
	}

	// reforge
	if (extraAttributes.modifier && skyblockItem?.category !== ItemCategory.Accessory) {
		const reforgeStone = getReforgeStone(extraAttributes.modifier, itemId);
		if (reforgeStone) price += getPrice(reforgeStone) * PriceModifier.Reforge;
	}

	// scrolls (Necron's Blade)
	if (extraAttributes.ability_scroll) {
		for (const _item of extraAttributes.ability_scroll) {
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

	// etherwarp (Aspect of the Void)
	if (extraAttributes.ethermerge) {
		price += (getPrice(ItemId.EtherwarpConduit) + getPrice(ItemId.EtherwarpMerger)) * PriceModifier.Etherwarp;
	}

	// mana disintegrator
	if (extraAttributes.mana_disintegrator_count) {
		price +=
			extraAttributes.mana_disintegrator_count * getPrice(ItemId.ManaDisintegrator) * PriceModifier.ManaDisintegrator;
	}

	// jalapeno book
	if (extraAttributes.jalapeno_count) {
		price += extraAttributes.jalapeno_count * getPrice(ItemId.JalapenoBook) * PriceModifier.JalapenoBook;
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
		// level 101..=199
		const LVL_100 = prices.get(`LVL_100_${pet.tier}_${pet.type}`);
		const LVL_200 = prices.get(`LVL_200_${pet.tier}_${pet.type}`);

		if (LVL_100 === undefined) {
			price = 0;
		} else if (LVL_200 === undefined) {
			price = LVL_100;
		} else {
			price = ((LVL_200 - LVL_100) / 100) * (level - 100) + LVL_100;
		}
	} else {
		// level 200
		price =
			prices.get(`LVL_200_${pet.tier}_${pet.type}`) ??
			prices.get(`LVL_100_${pet.tier}_${pet.type}`) ??
			getPrice(`LVL_1_${pet.tier}_${pet.type}`);
	}

	// held item
	if (pet.heldItem) {
		price += getPrice(pet.heldItem) * PriceModifier.PetItem;
	}

	// candy + skins
	if (pet.candyUsed) {
		if (!NON_REDUCED_PETS.has(pet.type as ItemId)) {
			price = Math.max(price * PriceModifier.PetWithCandy, price - (level >= 100 ? 5_000_000 : 2_500_000));
		}

		if (pet.skin) {
			// candy and skin
			price += getPrice(`PET_SKIN_${pet.skin}`) * PriceModifier.PetSkinWithCandy;
		}
	} else if (pet.skin) {
		// no candy and skin
		price += getPrice(`PET_SKIN_${pet.skin}`) * PriceModifier.PetSkinNoCandy;
	}

	return price;
}

/**
 * networth of a single running auction
 *
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
	const { auctions } = await hypixel.skyblock.auction.profile(profileId);

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
	{ banking, members, profile_id }: NonNullable<Components.Schemas.SkyBlockProfileCuteName>,
	uuid: string,
	{ addBanking = true, addAuctions = false } = {},
) {
	const member = members[uuid];
	if (!member) throw new Error(`No member with the uuid '${uuid}'`);

	// banking
	let bankingAPIEnabled = true;
	let networth =
		// co-op bank
		(addBanking ? banking?.balance ?? ((bankingAPIEnabled = false), 0) : 0) +
		// purse
		(member.coin_purse ?? 0) +
		// personal bank (for co-op members)
		(Object.keys(members).length > 1 ? member.bank_account ?? 0 : 0);

	const promises: Promise<number>[] = [];

	// auctions
	if (addAuctions) {
		promises.push(getAuctionNetworth(profile_id, uuid));
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
			networth += (count ?? 0) * getPrice(index);
		}
	}

	// essence
	for (const key of Object.keys(member)) {
		if (key.startsWith('essence_')) {
			networth += ((member[key as keyof typeof member] as number | undefined) ?? 0) * getPrice(key.toUpperCase());
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
