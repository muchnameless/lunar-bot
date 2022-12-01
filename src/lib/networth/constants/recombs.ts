import { ItemCategory, ItemId } from './index.js';

export const ALLOWED_RECOMB_CATEGORIES = new Set([
	ItemCategory.Accessory,
	ItemCategory.Belt,
	ItemCategory.Bracelet,
	ItemCategory.Cloak,
	ItemCategory.Gloves,
	ItemCategory.Necklace,
] as const satisfies readonly ItemCategory[]);

export const ALLOWED_RECOMB_ITEMS = new Set([
	ItemId.DivanBoots,
	ItemId.DivanChestplate,
	ItemId.DivanHelmet,
	ItemId.DivanLeggings,
] as const satisfies readonly ItemId[]);
