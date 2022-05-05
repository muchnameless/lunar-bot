import { ItemId } from './itemId';

export const MASTER_STARS = [
	ItemId.FirstMasterStar,
	ItemId.SecondMasterStar,
	ItemId.ThirdMasterStar,
	ItemId.FourthMasterStar,
	ItemId.FifthMasterStar,
] as const;

export const enum EssenceType {
	Wither = 'WITHER',
	Undead = 'UNDEAD',
	Gold = 'GOLD',
	Diamond = 'DIAMOND',
	Spider = 'SPIDER',
	Dragon = 'DRAGON',
	Ice = 'ICE',
	Crimson = 'CRIMSON',
}

export const enum EssencePrice {
	Wither = 4_000,
	Undead = 1_250,
	Gold = 3_000,
	Diamond = 3_000,
	Spider = 3_000,
	Dragon = 2_000,
	Ice = 2_000,
}
