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
 * whether the item is a (recombobulated) common item, uses the rarity colour code from the item's lore -> 2nd char of last line
 * @param item
 */
export const isCommonItem = (item: NBTInventoryItem) => {
	switch (item.tag!.display?.Lore?.at(-1)?.[1]) {
		case ItemRarityColourCode.Common:
		case undefined: // no lore
			return true;

		case ItemRarityColourCode.Uncommon:
			// recombobulated?
			return Boolean(item.tag!.ExtraAttributes?.rarity_upgrades);

		default:
			return false;
	}
};

/**
 * whether the item is a vanilla mc item and not a custom hypixel skyblock variant
 * @param item
 */
export const isVanillaItem = (item: NBTInventoryItem) =>
	isCommonItem(item) &&
	((item.tag!.display?.Lore?.length ?? 0) <= 1 ||
		item.tag!.ExtraAttributes!.id.includes(':') ||
		VANILLA_ITEM_DISPLAY_NAMES.has(
			item.tag!.display?.Name?.startsWith('§')
				? item.tag!.display.Name.slice(2 /* '§f'.length */)
				: item.tag!.display?.Name!,
		)) &&
	!item.tag!.SkullOwner;

/**
 * transforms gzipped nbt strings to objects
 * @param data
 */
export const transformItemData = async (data: string): Promise<NBTInventoryItem[]> =>
	simplify((await parse(Buffer.from(data, 'base64'))).parsed.value.i as never);
