/**
 * mc client version
 */
export const MC_CLIENT_VERSION = '1.18.2';

import minecraftData from 'minecraft-data/minecraft-data/data/pc/1.18/items.json' assert { type: 'json' };

/**
 * display names of vanilla mc items and blocks, including "null"
 */
export const VANILLA_ITEM_DISPLAY_NAMES = new Set<string>().add('null');

for (const { displayName } of minecraftData) {
	VANILLA_ITEM_DISPLAY_NAMES.add(displayName);
}
