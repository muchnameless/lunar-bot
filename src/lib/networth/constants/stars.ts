import { ItemId } from './itemId.js';

export const MASTER_STARS = [
	ItemId.FirstMasterStar,
	ItemId.SecondMasterStar,
	ItemId.ThirdMasterStar,
	ItemId.FourthMasterStar,
	ItemId.FifthMasterStar,
] as const satisfies readonly ItemId[];
