import { getPrice } from '../prices';
import { EssenceType, EssencePrice, ItemId } from '../constants';

/**
 * essence / item price
 * @param itemId
 */
export const getUpgradeMaterialPrice = (itemId: string) => {
	switch (itemId) {
		// essence
		case EssenceType.Wither:
			return EssencePrice.Wither;
		case EssenceType.Undead:
			return EssencePrice.Undead;
		case EssenceType.Gold:
			return EssencePrice.Gold;
		case EssenceType.Diamond:
			return EssencePrice.Diamond;
		case EssenceType.Spider:
			return EssencePrice.Spider;
		case EssenceType.Dragon:
			return EssencePrice.Dragon;
		case EssenceType.Ice:
			return EssencePrice.Ice;
		case EssenceType.Crimson:
			return Math.min(getPrice(ItemId.MoogmaLeggings) / 20, getPrice(ItemId.SlugBoots) / 15);

		// item
		default:
			return getPrice(itemId);
	}
};
