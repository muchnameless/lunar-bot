import { PET_RARITY_OFFSET, PET_LEVELS_XP } from '../constants/pets';
import { ItemId } from '../constants';
import type { Components } from '@zikeji/hypixel';

/**
 * @param pet
 */
export function calculatePetSkillLevel(pet: Components.Schemas.SkyBlockProfilePet) {
	const maxLevel = pet.type === ItemId.GoldenDragon ? 200 : 100;
	const rarityOffset = PET_RARITY_OFFSET[pet.tier as keyof typeof PET_RARITY_OFFSET];
	const levels = PET_LEVELS_XP.slice(rarityOffset, rarityOffset + maxLevel);

	let level = 0;
	let totalExperience = 0;

	for (; level < maxLevel && totalExperience <= pet.exp; ++level) {
		totalExperience += levels[level]!;
	}

	return {
		maxXP: levels.reduce((a, b) => a + b, 0),
		level,
	};
}
