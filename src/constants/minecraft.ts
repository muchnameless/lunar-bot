import minecraftDataLoader from 'minecraft-data';

/**
 * mc client version
 */
export const MC_CLIENT_VERSION = '1.18';

export const MINECRAFT_DATA = minecraftDataLoader(MC_CLIENT_VERSION);

export const VANILLA_ITEMS_AND_BLOCKS = new Set<string>(['null']);

for (const { displayName } of MINECRAFT_DATA.blocksArray) {
	VANILLA_ITEMS_AND_BLOCKS.add(displayName);
}

for (const { displayName } of MINECRAFT_DATA.itemsArray) {
	VANILLA_ITEMS_AND_BLOCKS.add(displayName);
}
