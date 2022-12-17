import { type Components } from '@zikeji/hypixel';
import { PET_XP_TOTAL } from '../constants/pets.js';

/**
 * @param pet
 */
export function calculatePetSkillLevel(pet: Components.Schemas.SkyBlockProfilePet) {
	const totalXp =
		PET_XP_TOTAL[pet.type as keyof typeof PET_XP_TOTAL] ?? PET_XP_TOTAL[pet.tier as keyof typeof PET_XP_TOTAL];

	return {
		level: totalXp.findLastIndex((requiredXp) => requiredXp <= pet.exp),
		maxXP: totalXp.at(-1)!,
	};
}
