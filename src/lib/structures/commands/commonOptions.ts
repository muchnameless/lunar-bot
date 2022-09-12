import { GuildMemberLimits } from '@sapphire/discord-utilities';
import { SlashCommandStringOption, SlashCommandBooleanOption, SlashCommandIntegerOption } from 'discord.js';
import {
	FindProfileStrategy,
	LEADERBOARD_XP_TYPES,
	MAX_IGN_INPUT_LENGTH,
	PROFILE_NAMES,
	XP_OFFSETS_CONVERTER,
	XP_OFFSETS_SHORT,
} from '#constants';
import { upperCaseFirstChar } from '#functions';
import { keys } from '#types';

export const optionalIgnOption = new SlashCommandStringOption()
	.setName('ign')
	.setDescription('IGN | UUID')
	.setRequired(false)
	.setMaxLength(MAX_IGN_INPUT_LENGTH);

export const requiredIgnOption = new SlashCommandStringOption()
	.setName('ign')
	.setDescription('IGN | UUID')
	.setRequired(true)
	.setMaxLength(MAX_IGN_INPUT_LENGTH);

const MAX_INPUT_LENGTH = Math.max(MAX_IGN_INPUT_LENGTH, '@'.length + GuildMemberLimits.MaximumDisplayNameLength);

export const optionalPlayerOption = new SlashCommandStringOption()
	.setName('player')
	.setDescription('IGN | UUID | discord ID | @mention')
	.setRequired(false)
	.setAutocomplete(true)
	.setMaxLength(MAX_INPUT_LENGTH);

export const requiredPlayerOption = new SlashCommandStringOption()
	.setName('player')
	.setDescription('IGN | UUID | discord ID | @mention')
	.setRequired(true)
	.setAutocomplete(true)
	.setMaxLength(MAX_INPUT_LENGTH);

export const targetOption = new SlashCommandStringOption()
	.setName('target')
	.setDescription("IGN | UUID | discord ID | @mention | 'guild' | 'everyone'")
	.setRequired(true)
	.setAutocomplete(true)
	.setMaxLength(MAX_INPUT_LENGTH);

export const forceOption = new SlashCommandBooleanOption()
	.setName('force')
	.setDescription('disable IGN autocorrection')
	.setRequired(false);

export const skyblockProfileOption = new SlashCommandStringOption()
	.setName('profile')
	.setDescription('SkyBlock profile name')
	.setRequired(false)
	.addChoices(...PROFILE_NAMES.map((x) => ({ name: x, value: x })));

export const skyblockFindProfileOptionName = 'find-profile';
export const skyblockFindProfileOption = new SlashCommandStringOption()
	.setName(skyblockFindProfileOptionName)
	.setDescription('strategy used to find a profile if none was selected')
	.setRequired(false)
	.addChoices(
		{
			name: 'max weight (default)',
			value: FindProfileStrategy.MaxWeight,
		},
		{
			name: 'last active',
			value: FindProfileStrategy.LastActive,
		},
	);

export const includeAuctionsOptionName = 'include-auctions';
export const includeAuctionsOption = new SlashCommandBooleanOption()
	.setName(includeAuctionsOptionName)
	.setDescription('include current auctions (default: false)')
	.setRequired(false);

export const xpTypeOption = new SlashCommandStringOption()
	.setName('type')
	.setDescription('xp type')
	.setRequired(false)
	.addChoices(...LEADERBOARD_XP_TYPES.map((x) => ({ name: upperCaseFirstChar(x.replaceAll('-', ' ')), value: x })));

export const pageOption = new SlashCommandIntegerOption()
	.setName('page')
	.setDescription('page number')
	.setRequired(false);

export const offsetOption = new SlashCommandStringOption()
	.setName('offset')
	.setDescription('Δ offset')
	.setRequired(false)
	.addChoices(
		...keys(XP_OFFSETS_SHORT).map((x) => ({
			name: x,
			value: XP_OFFSETS_CONVERTER[x],
		})),
	);

export const ephemeralOption = new SlashCommandStringOption()
	.setName('visibility')
	.setDescription('visibility of the response message')
	.setRequired(false)
	.addChoices(...['everyone', 'just me'].map((x) => ({ name: x, value: x })));

export const hypixelGuildOption = new SlashCommandStringOption()
	.setName('guild')
	.setDescription('hypixel guild')
	.setRequired(false)
	.setAutocomplete(true);
// TODO: add guild name length limit

export const ansiOutputOption = new SlashCommandBooleanOption()
	.setName('ansi')
	.setDescription('use ansi codeblocks (default: false)')
	.setRequired(false);
