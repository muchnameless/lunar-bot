import { ItemId } from './index.js';

/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * https://github.com/Altpapier/SkyHelperAPI/blob/master/constants/maro_networth/src/constants/misc.js#L96
 */
export const ITEM_SPECIFIC_IGNORED_ENCHANTS = {
	[ItemId.Bonemerang]: new Set([
		//
		Enchantment.Overload,
		Enchantment.Power,
		Enchantment.UltimateSoulEater,
	]),
	[ItemId.DeathBow]: new Set([
		//
		Enchantment.Overload,
		Enchantment.Power,
		Enchantment.UltimateSoulEater,
	]),
} as const;
/* eslint-enable @typescript-eslint/no-use-before-define */

export const enum Enchantment {
	Angler = 'angler',
	AquaAffinity = 'aqua_affinity',
	BaneOfArthropods = 'bane_of_arthropods',
	BigBrain = 'big_brain',
	BlastProtection = 'blast_protection',
	Blessing = 'blessing',
	Caster = 'caster',
	Cayenne = 'cayenne',
	Champion = 'champion',
	Chance = 'chance',
	Charm = 'charm',
	Cleave = 'cleave',
	Compact = 'compact',
	Corruption = 'corruption',
	CounterStrike = 'counter_strike',
	Critical = 'critical',
	Cubism = 'cubism',
	Cultivating = 'cultivating',
	Delicate = 'delicate',
	DepthStrider = 'depth_strider',
	DragonHunter = 'dragon_hunter',
	DragonTracer = 'aiming', // API still uses old name
	Efficiency = 'efficiency',
	EnderSlayer = 'ender_slayer',
	Execute = 'execute',
	Experience = 'experience',
	Expertise = 'expertise',
	FeatherFalling = 'feather_falling',
	FerociousMana = 'ferocious_mana',
	FireAspect = 'fire_aspect',
	FireProtection = 'fire_protection',
	FirstStrike = 'first_strike',
	Flame = 'flame',
	Fortune = 'fortune',
	Frail = 'frail',
	FrostWalker = 'frost_walker',
	GiantKiller = 'giant_killer',
	Growth = 'growth',
	HardenedMana = 'hardened_mana',
	Harvesting = 'harvesting',
	Hecatomb = 'hecatomb',
	Impaling = 'impaling',
	InfiniteQuiver = 'infinite_quiver',
	Knockback = 'knockback',
	Lethality = 'lethality',
	LifeSteal = 'life_steal',
	Looting = 'looting',
	Luck = 'luck',
	LuckOfTheSea = 'luck_of_the_sea',
	Lure = 'lure',
	Magnet = 'magnet',
	ManaSteal = 'mana_steal',
	ManaVampire = 'mana_vampire',
	Overload = 'overload',
	Piercing = 'piercing',
	Piscary = 'piscary',
	Power = 'power',
	Pristine = 'pristine',
	ProjectileProtection = 'projectile_protection',
	Prosecute = 'prosecute', // API shows it as 'PROSECUTE'
	Protection = 'protection',
	Punch = 'punch',
	Rainbow = 'rainbow',
	Rejuvenate = 'rejuvenate',
	Replenish = 'replenish',
	Respiration = 'respiration',
	Respite = 'respite',
	Scavenger = 'scavenger',
	Sharpness = 'sharpness',
	SilkTouch = 'silk_touch',
	SmartyPants = 'smarty_pants',
	SmeltingTouch = 'smelting_touch',
	Smite = 'smite',
	Smoldering = 'smoldering',
	Snipe = 'snipe',
	SpikedHook = 'spiked_hook',
	StrongMana = 'strong_mana',
	SugarRush = 'sugar_rush',
	Syphon = 'syphon',
	Tabasco = 'tabasco',
	Telekinesis = 'telekinesis', // removed
	Thorns = 'thorns',
	Thunderbolt = 'thunderbolt',
	Thunderlord = 'thunderlord',
	TitanKiller = 'titan_killer',
	TripleStrike = 'triple_strike',
	TrueProtection = 'true_protection',
	TurboCactus = 'turbo_cactus',
	TurboCane = 'turbo_cane',
	TurboCarrot = 'turbo_carrot',
	TurboCoco = 'turbo_coco',
	TurboMelon = 'turbo_melon',
	TurboMushrooms = 'turbo_mushrooms',
	TurboPotato = 'turbo_potato',
	TurboPumpkin = 'turbo_pumpkin',
	TurboWarts = 'turbo_warts',
	TurboWheat = 'turbo_wheat',
	UltimateBank = 'ultimate_bank',
	UltimateBobbinTime = 'ultimate_bobbin_time',
	UltimateChimera = 'ultimate_chimera',
	UltimateCombo = 'ultimate_combo',
	UltimateDuplex = 'ultimate_reiterate', // API still uses old name
	UltimateFatalTempo = 'ultimate_fatal_tempo',
	UltimateFlash = 'ultimate_flash',
	UltimateHabaneroTactics = 'ultimate_habanero_tactics',
	UltimateInferno = 'ultimate_inferno',
	UltimateJerry = 'ultimate_jerry',
	UltimateLastStand = 'ultimate_last_stand',
	UltimateLegion = 'ultimate_legion',
	UltimateNoPainNoGain = 'ultimate_no_pain_no_gain',
	UltimateOneForAll = 'ultimate_one_for_all',
	UltimateRend = 'ultimate_rend',
	UltimateSoulEater = 'ultimate_soul_eater',
	UltimateSwarm = 'ultimate_swarm',
	UltimateWisdom = 'ultimate_wisdom',
	UltimateWise = 'ultimate_wise',
	Vampirism = 'vampirism',
	Venomous = 'venomous',
	Vicious = 'vicious',
}
