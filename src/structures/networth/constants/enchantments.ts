import { ItemId } from '.';

export const BLOCKED_ENCHANTS = {
	[ItemId.Bonemerang]: ['overload', 'power'],
	[ItemId.DeathBow]: ['overload', 'power', 'ultimate_soul_eater'],
} as const;

export const REDUCED_VALUE_ENCHANTS = new Set(['overload', 'ultimate_soul_eater']);
