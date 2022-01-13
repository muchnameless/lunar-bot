const _CRAFTING_RECIPES = {
	// https://hypixel-skyblock.fandom.com/wiki/Artifact_of_Power
	POWER_TALISMAN: { ROUGH_RUBY_GEM: 3_600 },
	POWER_RING: {
		ROUGH_RUBY_GEM: 48_400,
		ROUGH_JADE_GEM: 25_600,
		ROUGH_AMBER_GEM: 25_600,
		ROUGH_AMETHYST_GEM: 25_600,
		ROUGH_SAPPHIRE_GEM: 25_600,
		SLUDGE_JUICE: 320,
	},
	POWER_ARTIFACT: {
		ROUGH_RUBY_GEM: 48_400,
		ROUGH_JADE_GEM: 844_800,
		ROUGH_AMBER_GEM: 844_800,
		ROUGH_AMETHYST_GEM: 844_800,
		ROUGH_SAPPHIRE_GEM: 844_800,
		SLUDGE_JUICE: 10_560,
	},
} as const;

/**
 * SkyBlock item crafting recipes, holds an array of { id, count } for each item
 */
export const CRAFTING_RECIPES = Object.fromEntries(
	Object.entries(_CRAFTING_RECIPES).map(([id, recipe]) => [
		id,
		Object.entries(recipe).map(([_id, count]) => ({ id: _id, count })),
	]),
);
