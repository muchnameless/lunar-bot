export const HYPIXEL_RANK = '(?:\\[.+?\\] )?';
export const IGN_DEFAULT = '\\w{1,16}';
export const GUILD_RANK_DEFAULT = '[a-zA-Z0-9 -]+';

const _genericErrors = {
	MUST_BE_GM: '^You must be the Guild Master to use that command[.!]?',
	MISSING_PERMS: '^You do not have permission to use this command[.!]?$',
	RANK_MISSING_PERMS: '^Your guild rank does not have permission to use this[.!]?$',
	unknownIgn: (ign = IGN_DEFAULT) => `^Can't find a player by the name of '${ign}'[.!]?$`,
	playerNotInGuild: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is not in your guild[.!]?`,
	unknownRank: (_0: unknown, _1: unknown, to = GUILD_RANK_DEFAULT) =>
		`^I couldn't find a rank by the name of '${to}'[.!]?`,
};

const _demote = {
	ERROR_SELF: '^You can only demote up to your own rank[.!]?$',
	errorAlreadyLowest: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is already the lowest rank`,
	errorGM: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is the guild master so can't be demoted[.!]?$`,
	success: (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) =>
		`^${HYPIXEL_RANK}(?<target>${ign}) was demoted from (?<oldRank>${from}) to (?<newRank>${to})$`,
};
const _invite = {
	ERROR_PERMS: '^You do not have permission to invite players[.!]?$',
	ERROR_CANNOT_INVITE: '^You cannot invite this player to your guild[.!]?$', // g invites disabled
	ERROR_GUILD_FULL: '^Your guild is full[.!]?$',
	successOnline: (ign = IGN_DEFAULT) =>
		`^You invited ${HYPIXEL_RANK}${ign} to your guild[.!]? They have 5 minutes to accept[.!]?$`,
	successOffline: (ign = IGN_DEFAULT) =>
		`^You sent an offline invite to ${HYPIXEL_RANK}${ign}[.!]? They will have 5 minutes to accept once they come online[.!]?$`,
	errorAlreadyInvited: (ign = IGN_DEFAULT) =>
		`^You've already invited ${HYPIXEL_RANK}${ign} to your guild[.!]? Wait for them to accept[.!]?$`,
	errorInAnotherGuild: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is already in (?:another|your) guild[.!]?$`,
};
const _kick = {
	ERROR_SELF: '^You cannot kick yourself from the guild[.!]?$',
	ERROR_PERMS: '^You do not have permission to kick people from the guild[.!]?$',
	success: (target = IGN_DEFAULT, executor = IGN_DEFAULT) =>
		`^${HYPIXEL_RANK}${target} was kicked from the guild by ${HYPIXEL_RANK}${executor}[.!]?$`,
};
const _mute = {
	ERROR_GM: '^You cannot mute the guild master[.!]?$',
	ERROR_SELF: '^You cannot mute yourself from the guild[.!]?$',
	ERROR_RANK: '^You cannot mute a guild member with a higher guild rank[.!]?$',
	ERROR_DURATION_TOO_LONG: '^You cannot mute someone for more than one month[.!]?$',
	ERROR_DURATION_TOO_SHORT: '^You cannot mute someone for less than a minute[.!]?$',
	ERROR_ALREADY_MUTED: '^This player is already muted[.!]?$',
	success: (target = `${IGN_DEFAULT}|the guild chat`, executor = IGN_DEFAULT) =>
		`^${HYPIXEL_RANK}(?<executor>${executor}) has muted ${HYPIXEL_RANK}(?<target>${target}) for (?<duration>\\w+)`,
};
const _paginationErrors = {
	RANGE_ERROR: '^Page must be between 1 and \\d+[.!]?$',
	NO_LOGS: '^There are no logs to display[.!]?$',
	NO_HISTORY: '^There is no recent history to display[.!]?$',
	INVALID_NUMBER: '^Not a valid number[.!]?$',
	NEGATIVE_NUMBER: '^Must be a positive number[.!]?$',
	invalidPageNumber: (ign = IGN_DEFAULT) => `'${ign}' is not a valid page number[.!]?$`,
};
const _promote = {
	ERROR_SELF: '^You can only promote up to your own rank[.!]?',
	errorAlreadyHighest: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is already the highest rank`,
	errorGM: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is the guild master so can't be promoted anymore[.!]?`,
	success: (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) =>
		`^${HYPIXEL_RANK}(?<target>${ign}) was promoted from (?<oldRank>${from}) to (?<newRank>${to})$`,
};
const _topErrors = {
	NO_DATA: '^No one earned guild experience on the \\d+/\\d+/\\d+[.!]?$',
};
const _unmute = {
	ERROR_NOT_MUTED: '^(?:This player|The guild) is not muted[.!]?$',
	success: (target = `${IGN_DEFAULT}|the guild chat`, executor = IGN_DEFAULT) =>
		`^${HYPIXEL_RANK}(?<executor>${executor}) has unmuted ${HYPIXEL_RANK}(?<target>${target})`,
};
const _slowMode = {
	success: (executor = IGN_DEFAULT) =>
		`^Guild > ${HYPIXEL_RANK}(?<executor>${executor}) (?:(?<enabled>enabled) the chat throttle! You can only send messages every 10 seconds|(?<disabled>disabled) the chat throttle)[.!]?$`,
};

const genericErrorResponses = Object.values(_genericErrors);
const demoteResponses = [
	...Object.values(_demote),
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
	_genericErrors.unknownIgn,
	_genericErrors.playerNotInGuild,
];
const historyErrorResponses = [
	_paginationErrors.RANGE_ERROR,
	_paginationErrors.NO_HISTORY,
	_paginationErrors.invalidPageNumber,
];
const inviteResponses = [
	...Object.values(_invite),
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
	_genericErrors.unknownIgn,
];
const kickResponses = [
	...Object.values(_kick),
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
	_genericErrors.unknownIgn,
	_genericErrors.playerNotInGuild,
];
const kickResponsesError = [
	...Object.entries(_kick)
		.filter(([key]) => key !== 'success')
		.map(([, value]) => value),
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
	_genericErrors.unknownIgn,
	_genericErrors.playerNotInGuild,
];
const logErrorResponses = [
	_paginationErrors.RANGE_ERROR,
	_paginationErrors.NO_LOGS,
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
	_genericErrors.unknownIgn,
];
const muteResponses = [
	...Object.values(_mute),
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
	_genericErrors.unknownIgn,
	_genericErrors.playerNotInGuild,
];
const promoteResponses = [
	...Object.values(_promote),
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
	_genericErrors.unknownIgn,
	_genericErrors.playerNotInGuild,
];
const setRankResponses = [
	...Object.values(_demote),
	...Object.values(_promote),
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
	_genericErrors.unknownIgn,
	_genericErrors.playerNotInGuild,
	_genericErrors.unknownRank,
];
const topErrorResponses = [
	...Object.values(_topErrors),
	_paginationErrors.INVALID_NUMBER,
	_paginationErrors.NEGATIVE_NUMBER,
];
const unmuteResponses = [
	...Object.values(_unmute),
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
	_genericErrors.unknownIgn,
	_genericErrors.playerNotInGuild,
];
const slowModeResponses = [
	...Object.values(_slowMode),
	_genericErrors.MUST_BE_GM,
	_genericErrors.MISSING_PERMS,
	_genericErrors.RANK_MISSING_PERMS,
];
const paginationErrorResponses = Object.values(_paginationErrors);

// dynamic RegExp constructors
export const genericErrors = (ign = IGN_DEFAULT, to = GUILD_RANK_DEFAULT) =>
	new RegExp(genericErrorResponses.map((x) => (typeof x === 'function' ? x(ign, undefined, to) : x)).join('|'), 'i');

export const unknownIgn = (ign = IGN_DEFAULT) => new RegExp(_genericErrors.unknownIgn(ign), 'i');

export const demote = (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) =>
	new RegExp(demoteResponses.map((x) => (typeof x === 'function' ? x(ign, from, to) : x)).join('|'), 'i');

export const paginationErrors = (ign = IGN_DEFAULT) =>
	new RegExp(paginationErrorResponses.map((x) => (typeof x === 'function' ? x(ign) : x)).join('|'), 'i');

export const historyErrors = (ign = IGN_DEFAULT) =>
	new RegExp(historyErrorResponses.map((x) => (typeof x === 'function' ? x(ign) : x)).join('|'), 'i');

export const invite = (ign = IGN_DEFAULT) =>
	new RegExp(inviteResponses.map((x) => (typeof x === 'function' ? x(ign) : x)).join('|'), 'i');

export const kick = {
	success: (target = IGN_DEFAULT, executor = IGN_DEFAULT) => new RegExp(_kick.success(target, executor), 'i'),
	error: (target = IGN_DEFAULT) =>
		new RegExp(kickResponsesError.map((x) => (typeof x === 'function' ? x(target) : x)).join('|'), 'i'),
	all: (target = IGN_DEFAULT, executor = IGN_DEFAULT) =>
		new RegExp(kickResponses.map((x) => (typeof x === 'function' ? x(target, executor) : x)).join('|'), 'i'),
};

export const logErrors = (ign = IGN_DEFAULT) =>
	new RegExp(logErrorResponses.map((x) => (typeof x === 'function' ? x(ign) : x)).join('|'), 'i');

export const mute = (target = IGN_DEFAULT, executor = IGN_DEFAULT) =>
	new RegExp(muteResponses.map((x) => (typeof x === 'function' ? x(target, executor) : x)).join('|'), 'i');

export const promote = (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) =>
	new RegExp(promoteResponses.map((x) => (typeof x === 'function' ? x(ign, from, to) : x)).join('|'), 'i');

export const setRank = (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) =>
	new RegExp(
		setRankResponses
			.map((x) => (typeof x === 'function' ? x(ign, from, to) : x))
			.join('|')
			.replace(/\?<.+?>/g, ''), // remove named capture groups as there would be multiple groups with the same name which is not allowed
		'i',
	);

export const topErrors = (ign = IGN_DEFAULT) =>
	new RegExp(
		topErrorResponses
			.map((x) =>
				typeof x === 'function'
					? // @ts-expect-error future proofing
					  x(ign)
					: x,
			)
			.join('|'),
		'i',
	);

export const unmute = (target = IGN_DEFAULT, executor = IGN_DEFAULT) =>
	new RegExp(unmuteResponses.map((x) => (typeof x === 'function' ? x(target, executor) : x)).join('|'), 'i');

export const slowMode = (executor = IGN_DEFAULT) =>
	new RegExp(slowModeResponses.map((x) => (typeof x === 'function' ? x(executor) : x)).join('|'), 'i');

// static RegExp
export const spamMessages = new RegExp(
	[
		'You cannot say the same message twice!',
		'You can only send a message once every half second!',
		'Blocked excessive spam.',
		'You are sending commands too fast! Please slow down.',
		'Please wait before doing that again!',
	]
		.map((x) => `^${x.replace(/[!.]/g, '[.!]?')}$`)
		.join('|'),
	'i',
);

export const demoteSuccess = new RegExp(_demote.success(), 'i');
export const kickSuccess = new RegExp(_kick.success(), 'i');
export const muteSuccess = new RegExp(_mute.success(), 'i');
export const promoteSuccess = new RegExp(_promote.success(), 'i');
export const unmuteSuccess = new RegExp(_unmute.success(), 'i');
export const slowModeChange = new RegExp(_slowMode.success(), 'i');
