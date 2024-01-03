export const SKYBLOCK_INVENTORIES = [
	'ender_chest_contents',
	'equipment_contents',
	'inv_armor',
	'inv_contents',
	'personal_vault_contents',
	'wardrobe_contents',
] as const satisfies readonly string[];

export const SKYBLOCK_BAG_INVENTORIES = [
	'fishing_bag',
	'potion_bag',
	'quiver',
	'talisman_bag',
] as const satisfies readonly string[];

export const SKYBLOCK_SHARED_INVENTORIES = [
	'candy_inventory_contents', //
] as const satisfies readonly string[];
