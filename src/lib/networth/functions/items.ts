import { type NBTInventoryItem } from '@zikeji/hypixel';
import { ItemRarityColourCode } from '../constants/index.js';
import { VANILLA_ITEM_DISPLAY_NAMES, VANILLA_ITEM_IDS } from '#constants';
import { removeMcFormatting } from '#functions';

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
			return Boolean(item.tag!.ExtraAttributes?.rarity_upgrades);

		default:
			return false;
	}
};

/**
 * returns the display name of a common item, doesn't work (and does not need to work) for multiple colour codes
 *
 * @param item
 */
export const getDisplayName = (item: NBTInventoryItem) => {
	let name = item.tag!.display!.Name;
	if (!name) return null;

	// remove colour code(s)
	name = removeMcFormatting(name);

	// remove reforge
	if (item.tag!.ExtraAttributes!.modifier && name.startsWith(item.tag!.ExtraAttributes!.modifier)) {
		name = name.slice(item.tag!.ExtraAttributes!.modifier.length).trimStart();
	}

	return name;
};

/**
 * whether the item is a vanilla mc item and not a custom hypixel skyblock variant
 *
 * @param item
 */
export const isVanillaItem = (item: NBTInventoryItem) =>
	// higher rarity
	isCommonItem(item) &&
	// no lore
	((item.tag!.display?.Lore?.length ?? 0 <= 1) ||
		// null items
		item.tag!.ExtraAttributes!.id.includes(':') ||
		// BOW, modifier: "rich_bow" instead of "rich"
		VANILLA_ITEM_IDS.has(item.tag!.ExtraAttributes!.id) ||
		// displayName: "Golden ...", itemId: "GOLD_..."; displayName: "Wooden ...", itemId: "WOOD_..."
		VANILLA_ITEM_DISPLAY_NAMES.has(getDisplayName(item))) &&
	// don't filter out items with custom skins
	!item.tag!.SkullOwner;
