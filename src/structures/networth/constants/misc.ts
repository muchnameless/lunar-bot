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
	bone_boomerang: new Set(['overload', 'power']),
	death_bow: new Set(['overload', 'power', 'ultimate_soul_eater']),
};

export const MASTER_STARS = ['first_master_star', 'second_master_star', 'third_master_star', 'fourth_master_star'];

export const SKYBLOCK_INVENTORIES = [
	'inv_contents',
	'ender_chest_contents',
	'inv_armor',
	'wardrobe_contents',
	'talisman_bag',
] as const;
