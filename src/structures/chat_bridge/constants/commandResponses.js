'use strict';

const HYPIXEL_RANK = '(?:\\[.+?\\] )?';
const IGN_DEFAULT = '\\w{1,16}';
const GUILD_RANK_DEFAULT = '[a-zA-Z0-9 -]+';

const genericErrors = {
	MUST_BE_GM: '^You must be the Guild Master to use that command[.!]?',
	MISSING_PERMS: '^You do not have permission to use this command[.!]?$',
	unknownIgn: (ign = IGN_DEFAULT) => `^Can't find a player by the name of '${ign}'[.!]?$`,
	playerNotInGuild: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is not in your guild[.!]?`,
	unknownRank: (_0, _1, to = GUILD_RANK_DEFAULT) => `^I couldn't find a rank by the name of '${to}'[.!]?`,
};
const demote = {
	ERROR_SELF: '^You can only demote up to your own rank[.!]?$',
	errorAlreadyLowest: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is already the lowest rank`,
	errorGM: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is the guild master so can't be demoted[.!]?$`,
	success: (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) => `^${HYPIXEL_RANK}(?<target>${ign}) was demoted from (?<oldRank>${from}) to (?<newRank>${to})$`,
};
const promote = {
	ERROR_SELF: '^You can only promote up to your own rank[.!]?',
	errorAlreadyHighest: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is already the highest rank`,
	errorGM: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is the guild master so can't be promoted anymore[.!]?`,
	success: (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) => `^${HYPIXEL_RANK}(?<target>${ign}) was promoted from (?<oldRank>${from}) to (?<newRank>${to})$`,
};
const mute = {
	ERROR_GM: '^You cannot mute the guild master[.!]?$',
	ERROR_SELF: '^You cannot mute yourself from the guild[.!]?$',
	ERROR_DURATION_TOO_LONG: '^You cannot mute someone for more than one month[.!]?$',
	ERROR_DURATION_TOO_SHORT: '^You cannot mute someone for less than a minute[.!]?$',
	ERROR_ALREADY_MUTED: '^This player is already muted[.!]?$',
	success: (target = `${IGN_DEFAULT}|the guild chat`, executor = IGN_DEFAULT) => `^${HYPIXEL_RANK}(?<executor>${executor}) has muted ${HYPIXEL_RANK}(?<target>${target}) for (?<duration>\\w+)`,
};
const unmute = {
	ERROR_NOT_MUTED: '^(?:This player|The guild) is not muted[.!]?$',
	success: (target = `${IGN_DEFAULT}|the guild chat`, executor = IGN_DEFAULT) => `^${HYPIXEL_RANK}(?<executor>${executor}) has unmuted ${HYPIXEL_RANK}(?<target>${target})`,
};
const invite = {
	ERROR_PERMS: '^You do not have permission to invite players[.!]?$',
	ERROR_CANNOT_INVITE: '^You cannot invite this player to your guild[.!]?$', // g invites disabled
	ERROR_GUILD_FULL: '^Your guild is full[.!]?$',
	successOnline: (ign = IGN_DEFAULT) => `^You invited ${HYPIXEL_RANK}${ign} to your guild[.!]? They have 5 minutes to accept[.!]?$`,
	successOffline: (ign = IGN_DEFAULT) => `^You sent an offline invite to ${HYPIXEL_RANK}${ign}[.!]? They will have 5 minutes to accept once they come online[.!]?$`,
	errorAlreadyInvited: (ign = IGN_DEFAULT) => `^You've already invited ${HYPIXEL_RANK}${ign} to your guild[.!]? Wait for them to accept[.!]?$`,
	errorInAnotherGuild: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is already in (?:another|your) guild[.!]?$`,
};
const paginationErrors = {
	RANGE_ERROR: '^Page must be between 1 and \\d+[.!]?$',
	NO_LOGS: 'There are no logs to display[.!]?$',
	NO_HISTORY: 'There is no recent history to display[.!]?$',
	INVALID_NUMBER: '^Not a valid number[.!]?$',
	NEGATIVE_NUMBER: '^Must be a positive number[.!]?$',
	invalidPageNumber: (ign = IGN_DEFAULT) => `'${ign}' is not a valid page number[.!]?$`,
};
const topErrors = {
	NO_DATA: '^No one earned guild experience on the \\d+/\\d+/\\d+[.!]?$',
};

const demoteResponses = [
	...Object.values(demote),
	genericErrors.MUST_BE_GM,
	genericErrors.MISSING_PERMS,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
];
const promoteResponses = [
	...Object.values(promote),
	genericErrors.MUST_BE_GM,
	genericErrors.MISSING_PERMS,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
];
const setRankResponses = [
	...Object.values(demote),
	...Object.values(promote),
	genericErrors.MUST_BE_GM,
	genericErrors.MISSING_PERMS,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
	genericErrors.unknownRank,
];
const muteResponses = [
	...Object.values(mute),
	genericErrors.MUST_BE_GM,
	genericErrors.MISSING_PERMS,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
];
const unmuteResponses = [
	...Object.values(unmute),
	genericErrors.MUST_BE_GM,
	genericErrors.MISSING_PERMS,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
];
const inviteResponses = [
	...Object.values(invite),
	genericErrors.MUST_BE_GM,
	genericErrors.MISSING_PERMS,
	genericErrors.unknownIgn,
];
const logErrorResponses = [
	paginationErrors.RANGE_ERROR,
	paginationErrors.NO_LOGS,
	genericErrors.unknownIgn,
];
const historyErrorResponses = [
	paginationErrors.RANGE_ERROR,
	paginationErrors.NO_HISTORY,
	paginationErrors.invalidPageNumber,
];
const topErrorResponses = [
	...Object.values(topErrors),
	paginationErrors.INVALID_NUMBER,
	paginationErrors.NEGATIVE_NUMBER,
];


module.exports = {
	defaults: {
		ign: IGN_DEFAULT,
		guildRank: GUILD_RANK_DEFAULT,
		hypixelRank: HYPIXEL_RANK,
	},
	genericErrors: {
		string: genericErrors,
		regExp: (ign = IGN_DEFAULT, to = GUILD_RANK_DEFAULT) => new RegExp(genericErrors.map(x => (typeof x === 'function' ? x(ign, undefined, to) : x)).join('|'), 'i'),
	},
	paginationErrors: {
		string: paginationErrors,
	},
	demote: {
		string: demote,
		regExp: (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) => new RegExp(demoteResponses.map(x => (typeof x === 'function' ? x(ign, from, to) : x)).join('|'), 'i'),
	},
	promote: {
		string: promote,
		regExp: (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) => new RegExp(promoteResponses.map(x => (typeof x === 'function' ? x(ign, from, to) : x)).join('|'), 'i'),
	},
	setRank: {
		regExp: (ign = IGN_DEFAULT, from = GUILD_RANK_DEFAULT, to = GUILD_RANK_DEFAULT) => new RegExp(
			setRankResponses
				.map(x => (typeof x === 'function' ? x(ign, from, to) : x))
				.join('|')
				.replace(/\?<.+?>/g, ''), // remove named capture groups as there would be multiple groups with the same name which is not allowed
			'i',
		),
	},
	mute: {
		string: mute,
		regExp: (target = IGN_DEFAULT, executor = IGN_DEFAULT) => new RegExp(muteResponses.map(x => (typeof x === 'function' ? x(target, executor) : x)).join('|'), 'i'),
	},
	unmute: {
		string: unmute,
		regExp: (target = IGN_DEFAULT, executor = IGN_DEFAULT) => new RegExp(unmuteResponses.map(x => (typeof x === 'function' ? x(target, executor) : x)).join('|'), 'i'),
	},
	invite: {
		string: invite,
		regExp: (ign = IGN_DEFAULT) => new RegExp(inviteResponses.map(x => (typeof x === 'function' ? x(ign) : x)).join('|'), 'i'),
	},
	logErrors: {
		string: paginationErrors,
		regExp: (ign = IGN_DEFAULT) => new RegExp(logErrorResponses.map(x => (typeof x === 'function' ? x(ign) : x)).join('|'), 'i'),
	},
	historyErrors: {
		string: paginationErrors,
		regExp: (ign = IGN_DEFAULT) => new RegExp(historyErrorResponses.map(x => (typeof x === 'function' ? x(ign) : x)).join('|'), 'i'),
	},
	topErrors: {
		string: topErrorResponses,
		regExp: (ign = IGN_DEFAULT) => new RegExp(topErrorResponses.map(x => (typeof x === 'function' ? x(ign) : x)).join('|'), 'i'),
	},
	spamMessages: [
		'You cannot say the same message twice[.!]?',
		'You can only send a message once every half second[.!]?',
		'Blocked excessive spam[.!]?',
		'You are sending commands too fast[.!]? Please slow down[.!]?',
	],
};
