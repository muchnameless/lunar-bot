import { Buffer } from 'node:buffer';
import { simplify, parse } from 'prismarine-nbt';
import type { NBTInventoryItem } from '@zikeji/hypixel';

/**
 * wether the item is a vanilla mc item and not a custom hypixel skyblock variant
 * @param item
 */
export const isVanillaItem = (item: NBTInventoryItem) =>
	(item.tag!.display?.Lore?.length ?? 0) <= 1 &&
	/^(?:§[\da-gk-or])*COMMON/.test(item.tag!.display?.Lore?.[0]!) &&
	!item.tag!.SkullOwner;

/**
 * transforms gzipped nbt strings to objects
 * @param data
 */
export const transformItemData = async (data: string): Promise<NBTInventoryItem[]> =>
	simplify((await parse(Buffer.from(data, 'base64'))).parsed.value.i as never);
