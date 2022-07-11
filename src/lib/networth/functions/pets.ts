import { ItemId } from '../constants';
import { PET_XP_TOTAL } from '../constants/pets';
import type { Components } from '@zikeji/hypixel';

/**
 * @param pet
 */
export function calculatePetSkillLevel(pet: Components.Schemas.SkyBlockProfilePet) {
	const totalXp = PET_XP_TOTAL[pet.type === ItemId.GoldenDragon ? pet.type : (pet.tier as keyof typeof PET_XP_TOTAL)];

	return {
		level: totalXp.findLastIndex((requiredXp) => requiredXp <= pet.exp),
		maxXP: totalXp.at(-1)!,
	};
}
