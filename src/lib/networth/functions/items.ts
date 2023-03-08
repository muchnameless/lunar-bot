import { type NBTInventoryItem } from '@zikeji/hypixel';
import { ItemRarityColourCode } from '../constants/index.js';

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
 *
 * @param item
 */
export const isCommonItem = (item: NBTInventoryItem) => {
	switch (item.tag!.display?.Lore?.at(-1)?.[1]) {
		case ItemRarityColourCode.Common:
		case undefined: // no lore
			return true;

		case ItemRarityColourCode.Uncommon:
			// recombobulated?
			return Boolean(item.tag!.ExtraAttributes!.rarity_upgrades);

		default:
			return false;
	}
};
