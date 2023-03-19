import { ItemId } from './itemId.js';

export const ATTRIBUTES_BASE = {
	[ItemId.GlowstoneGauntlet]: ItemId.GlowstoneGauntlet,
	[ItemId.VanquishedGlowstoneGauntlet]: ItemId.GlowstoneGauntlet,
	[ItemId.BlazeBelt]: ItemId.BlazeBelt,
	[ItemId.VanquishedBlazeBelt]: ItemId.BlazeBelt,
	[ItemId.MagmaNecklace]: ItemId.MagmaNecklace,
	[ItemId.VanquishedMagmaNecklace]: ItemId.MagmaNecklace,
	[ItemId.MagmaRod]: ItemId.MagmaRod,
	[ItemId.InfernoRod]: ItemId.MagmaRod,
	[ItemId.HellfireRod]: ItemId.MagmaRod,
} as const satisfies Partial<Record<ItemId, ItemId>>;
