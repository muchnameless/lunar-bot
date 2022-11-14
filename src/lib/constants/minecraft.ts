import minecraftData from 'minecraft-data/minecraft-data/data/pc/1.19/items.json' assert { type: 'json' };

const MAX_IGN_LENGTH = 16;
const MAX_UUID_LENGTH = 32;
export const MAX_IGN_INPUT_LENGTH = Math.max(MAX_IGN_LENGTH, MAX_UUID_LENGTH);

/**
 * mc client version
 */
export const MC_CLIENT_VERSION = '1.19';

/**
 * display names of vanilla mc items and blocks
 */
export const VANILLA_ITEM_DISPLAY_NAMES = new Set<string>();
/**
 * itemIds of vanilla mc items and blocks
 */
export const VANILLA_ITEM_IDS = new Set<string>();

// INIT
for (const { displayName, name } of minecraftData) {
	VANILLA_ITEM_DISPLAY_NAMES.add(displayName);
	VANILLA_ITEM_IDS.add(name.toUpperCase());
}
