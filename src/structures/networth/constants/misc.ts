export const SKYBLOCK_INVENTORIES = [
	'inv_contents',
	'ender_chest_contents',
	'inv_armor',
	'wardrobe_contents',
	'talisman_bag',
	'personal_vault_contents',
] as const;

/**
 * 12 per hour (every 5 mins), 6 hours, -1 since the new value gets pushed before calculating the median
 */
export const MAX_HISTORY_LENGTH = 71;
