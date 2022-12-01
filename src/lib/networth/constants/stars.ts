import { ItemId } from './index.js';

export const MASTER_STARS = [
	ItemId.FirstMasterStar,
	ItemId.SecondMasterStar,
	ItemId.ThirdMasterStar,
	ItemId.FourthMasterStar,
	ItemId.FifthMasterStar,
] as const satisfies readonly ItemId[];
