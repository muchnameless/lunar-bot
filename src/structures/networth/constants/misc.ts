/* eslint-disable camelcase */
export const ALLOWED_ENCHANTS = new Set([
	'ultimate_chimera',
	'ultimate_combo',
	'ultimate_last_stand',
	'ultimate_legion',
	'ultimate_rend',
	'ultimate_soul_eater',
	'ultimate_wise',
	'ultimate_wisdom',
	'ultimate_no_pain_no_gain',
	'ultimate_swarm',
	'ender_slayer',
	'giant_killer',
	'first_strike',
	'sharpness',
	'vicious',
	'overload',
	'ultimate_one_for_all',
	'efficiency',
	'big_brain',
	'protection',
	'pristine',
	'growth',
	'cubism',
	'snipe',
	'power',
]);

export const BLOCKED_ENCHANTS = {
	BONE_BOOMERANG: new Set(['overload', 'power']),
	DEATH_BOW: new Set(['overload', 'power', 'ultimate_soul_eater']),
};

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
