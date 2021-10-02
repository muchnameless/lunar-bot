declare module 'lilyweight' {
	interface WeightData {
		total: number;
		slayer: number;
		skill: {
			overflow: number;
			base: number;
		};
		catacombs: {
			completion: {
				base: number;
				master: number;
			};
			experience: number;
		};
	}
	
	interface CataCompletion {
		0: number;
		1: number;
		2: number;
		3: number;
		4: number;
		5: number;
		6: number;
		7: number;
	}
	
	interface MasterCataCompletion {
		1: number;
		2: number;
		3: number;
		4: number;
		5: number;
		6: number;
	}

	export default function(key?: string): {
		/**
		 * Gets the player's raw weight. This makes no API requests.
		 * Order of skills: enchanting, taming, alchemy, mining, farming, foraging, combat, fishing.
		 * Order of slayers: zombie, spider, wolf, enderman.
		 * @param skillLevels - Array of skill levels in the order listed above. They all scale up to 60.
		 * @param skillXP - Array of skill XP in the order listed above.
		 * @param cataCompl - Object of catacombs completion, e.g. { "0": 13, "1": 37, "2": 32, ... }.
		 * @param mCataCompl - Object of master catacombs completion, same format as cataCompl.
		 * @param cataXP - Catacombs experience.
		 * @param slayerXP - Array of slayer experience amounts in the order listed above.
		 */
		getWeightRaw(skillLevels: number[], skillXP: number[], cataCompl: Partial<CataCompletion>, mCataCompl: Partial<MasterCataCompletion>, cataXP: number, slayerXP: number[]): WeightData,
	}
}
