import minecraftDataLoader from 'minecraft-data';

/**
 * mc client version
 */
export const MC_CLIENT_VERSION = '1.18';

/**
 * minecraft data from the version the bridge bot uses
 */
export const MINECRAFT_DATA = minecraftDataLoader(MC_CLIENT_VERSION);

/**
 * display names of vanilla mc items and blocks, including "null"
 */
export const VANILLA_ITEM_NAMES = new Set<string>(['null']);

for (const { displayName } of MINECRAFT_DATA.itemsArray) {
	VANILLA_ITEM_NAMES.add(displayName);
}
