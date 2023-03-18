import type { Components } from '@zikeji/hypixel';
import { PET_XP_TOTAL } from '../constants/pets.js';
import { logger } from '#logger';

/**
 * @param pet
 */
export function calculatePetSkillLevel(pet: Components.Schemas.SkyBlockProfilePet) {
	// pet.tier is not affected by tier boost
	const totalXp =
		PET_XP_TOTAL[pet.type as keyof typeof PET_XP_TOTAL] ?? PET_XP_TOTAL[pet.tier as keyof typeof PET_XP_TOTAL];

	if (totalXp) {
		return {
			level: totalXp.findLastIndex((requiredXp) => requiredXp <= pet.exp),
			maxXP: totalXp.at(-1)!,
		};
	}

	logger.warn({ pet }, '[CALCULATE PET SKILL LEVEL]: unknown type and tier');
	return {
		level: 0,
		maxXP: 0,
	};
}
