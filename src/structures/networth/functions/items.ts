import { Buffer } from 'node:buffer';
import { simplify, parse } from 'prismarine-nbt';
import { ItemRarityColourCode } from '../constants/itemRarity';
import { VANILLA_ITEM_DISPLAY_NAMES } from '../../../constants/minecraft';
import type { NBTInventoryItem } from '@zikeji/hypixel';

/**
 * Lore examples
 *
 * "§f§lCOMMON"
 * "§a§lUNCOMMON"
 * "§9§lRARE"
 * "§5§lEPIC REFORGE STONE"
 * "§6§lLEGENDARY DUNGEON CHESTPLATE"
 * "§d§l§ka§r §d§l§d§lMYTHIC DUNGEON BOOTS §d§l§ka"
 * "§b§l§ka§r §b§l§b§lDIVINE DRILL §b§l§ka"
 * "§c§lSPECIAL"
 * "§c§l§ka§r §c§l§c§lVERY SPECIAL DUNGEON HELMET §c§l§ka"
 */

/**
 * get the rarity colour code from the item's lore -> 2nd char of last line
 * @param item
 */
export const getRarityColourCode = (item: NBTInventoryItem) => {
	const COLOUR_CODE = item.tag!.display?.Lore?.at(-1)?.[1];

	// not recombobulated
	if (!item.tag!.ExtraAttributes?.rarity_upgrades) return (COLOUR_CODE as ItemRarityColourCode) ?? null;

	// recombobulated -> reduce rarity by 1
	switch (COLOUR_CODE) {
		// case ItemRarityColourCode.Common: // lowest tier -> cannot be upgraded

		case ItemRarityColourCode.Uncommon:
			return ItemRarityColourCode.Common;

		case ItemRarityColourCode.Rare:
			return ItemRarityColourCode.Uncommon;

		case ItemRarityColourCode.Epic:
			return ItemRarityColourCode.Rare;

		case ItemRarityColourCode.Legendary:
			return ItemRarityColourCode.Epic;

		case ItemRarityColourCode.Mythic:
			return ItemRarityColourCode.Legendary;

		case ItemRarityColourCode.Divine:
			return ItemRarityColourCode.Mythic;

		case ItemRarityColourCode.Special:
		case ItemRarityColourCode.VerySpecial:
			return ItemRarityColourCode.Special;

		default:
			return null;
	}
};

/**
 * whether the item is a vanilla mc item and not a custom hypixel skyblock variant
 * @param item
 */
export const isVanillaItem = (item: NBTInventoryItem) =>
	[ItemRarityColourCode.Common, null].includes(getRarityColourCode(item)) &&
	((item.tag!.display?.Lore?.length ?? 0) <= 1 ||
		item.tag!.ExtraAttributes!.id.includes(':') ||
		VANILLA_ITEM_DISPLAY_NAMES.has(item.tag!.display?.Name?.replace(/§[\da-gk-or]/g, '').trim()!)) &&
	!item.tag!.SkullOwner;

/**
 * transforms gzipped nbt strings to objects
 * @param data
 */
export const transformItemData = async (data: string): Promise<NBTInventoryItem[]> =>
	simplify((await parse(Buffer.from(data, 'base64'))).parsed.value.i as never);
