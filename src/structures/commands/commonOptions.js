import { SlashCommandStringOption, SlashCommandBooleanOption, SlashCommandIntegerOption } from '@discordjs/builders';
import {
	COSMETIC_SKILLS,
	DUNGEON_TYPES_AND_CLASSES,
	GUILD_ID_ALL,
	PROFILE_NAMES,
	SKILLS,
	SLAYERS,
	XP_OFFSETS_CONVERTER,
	XP_OFFSETS_SHORT,
} from '../../constants/index.js';


export const optionalIgnOption = new SlashCommandStringOption()
	.setName('ign')
	.setDescription('IGN | UUID')
	.setRequired(false);

export const requiredIgnOption = new SlashCommandStringOption()
	.setName('ign')
	.setDescription('IGN | UUID')
	.setRequired(true);

export const optionalPlayerOption = new SlashCommandStringOption()
	.setName('player')
	.setDescription('IGN | UUID | discord ID | @mention')
	.setRequired(false);

export const requiredPlayerOption = new SlashCommandStringOption()
	.setName('player')
	.setDescription('IGN | UUID | discord ID | @mention')
	.setRequired(true);

export const targetOption = new SlashCommandStringOption()
	.setName('target')
	.setDescription('IGN | UUID | discord ID | @mention | \'guild\' | \'everyone\'')
	.setRequired(true);

export const forceOption = new SlashCommandBooleanOption()
	.setName('force')
	.setDescription('disable IGN autocorrection')
	.setRequired(false);

export const skyblockProfileOption = new SlashCommandStringOption()
	.setName('profile')
	.setDescription('SkyBlock profile name')
	.setRequired(false)
	.addChoices(PROFILE_NAMES.map(x => [ x, x ]));

export const xpTypeOption = new SlashCommandStringOption()
	.setName('type')
	.setDescription('xp type')
	.setRequired(false)
	.addChoices([
		'weight',
		[ 'skill average', 'skill-average' ],
		...SKILLS,
		...COSMETIC_SKILLS,
		'slayer',
		...SLAYERS,
		...DUNGEON_TYPES_AND_CLASSES,
		'guild',
	].map(x => (typeof x === 'string' ? [ x, x ] : x)));

export const pageOption = new SlashCommandIntegerOption()
	.setName('page')
	.setDescription('page number')
	.setRequired(false);

export const offsetOption = new SlashCommandStringOption()
	.setName('offset')
	.setDescription('Δ offset')
	.setRequired(false)
	.addChoices(Object.keys(XP_OFFSETS_SHORT).map(x => [ x, XP_OFFSETS_CONVERTER[x] ]));

export const ephemeralOption = new SlashCommandStringOption()
	.setName('visibility')
	.setDescription('visibility of the response message')
	.setRequired(false)
	.addChoices([ 'everyone', 'just me' ].map(x => [ x, x ]));

/**
 * @param {import('../LunarClient').LunarClient} client
 * @param {boolean} [includeAll=false]
 */
export function buildGuildOption(client, includeAll = false) {
	const guildOption = new SlashCommandStringOption()
		.setName('guild')
		.setDescription('hypixel guild')
		.setRequired(false)
		.addChoices(client.hypixelGuilds.cache.map(({ name, guildId }) => [ name, guildId ]));

	if (includeAll) guildOption.addChoice('add', GUILD_ID_ALL);

	return guildOption;
}
