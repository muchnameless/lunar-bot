import { Buffer } from 'node:buffer';
import { simplify, parse } from 'prismarine-nbt';
import type { NBTInventoryItem } from '@zikeji/hypixel';

/**
 * transforms gzipped nbt strings to objects
 * @param data
 */
export const transformItemData = async (data: string): Promise<NBTInventoryItem[]> =>
	simplify((await parse(Buffer.from(data, 'base64'))).parsed.value.i as never);
