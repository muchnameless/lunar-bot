/**
 * senither
 * https://github.com/Senither/Hypixel-Skyblock-Assistant/find/master and search for 'weight'
 */

export const SKILL_EXPONENTS = {
	taming: 1.147_44,
	farming: 1.217_848_139,
	mining: 1.182_074_48,
	combat: 1.157_976_872_65,
	foraging: 1.232_826,
	fishing: 1.406_418,
	enchanting: 0.969_765_83,
	alchemy: 1,
} as const;

export const SKILL_DIVIDER = {
	taming: 441_379,
	farming: 220_689,
	mining: 259_634,
	combat: 275_862,
	foraging: 259_634,
	fishing: 88_274,
	enchanting: 882_758,
	alchemy: 1_103_448,
} as const;

export const SLAYER_DIVIDER = {
	zombie: 2_208,
	spider: 2_118,
	wolf: 1_962,
	enderman: 1_430,
	// TODO
	blaze: Number.POSITIVE_INFINITY,
} as const;

export const SLAYER_MODIFIER = {
	zombie: 0.15,
	spider: 0.08,
	wolf: 0.015,
	enderman: 0.017,
	// TODO
	blaze: 0,
} as const;

export const DUNGEON_EXPONENTS = {
	catacombs: 0.000_214_960_461_5,
	healer: 0.000_004_525_483_4,
	mage: 0.000_004_525_483_4,
	berserk: 0.000_004_525_483_4,
	archer: 0.000_004_525_483_4,
	tank: 0.000_004_525_483_4,
} as const;

/**
 * lily
 * https://github.com/Antonio32A/lilyweight
 */

import lilyConstants from 'lilyweight/lib/constants.json' assert { type: 'json' };
import { keys } from '../types/util';

export const LILY_SKILL_NAMES_API = keys(lilyConstants.skillNames);
export const LILY_SKILL_NAMES = keys(lilyConstants.skillRatioWeight);
