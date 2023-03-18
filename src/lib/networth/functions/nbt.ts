import { Buffer } from 'node:buffer';
import type { NBTInventoryItem } from '@zikeji/hypixel';
import { simplify, parse } from 'prismarine-nbt';

/**
 * transforms gzipped nbt strings to objects
 *
 * @param data
 */
export const transformItemData = async (data: string): Promise<[NBTInventoryItem]> =>
	simplify((await parse(Buffer.from(data, 'base64'), 'big')).parsed.value.i as never);
