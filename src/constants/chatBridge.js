'use strict';

const HYPIXEL_RANK = '(?:\\[.+?\\] )?';
const IGN_DEFAULT = '\\w+';
const RANK_DEFAULT = '[a-z]+';

const genericErrors = {
	MUST_BE_GM: '^You must be the Guild Master to use that command!',
	unknownIgn: (ign = IGN_DEFAULT) => `^Can't find a player by the name of '${ign}'`,
	playerNotInGuild: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is not in your guild!`,
	unknownRank: (_0, _1, to = IGN_DEFAULT) => `^I couldn't find a rank by the name of '${to}'!`,
};
const demote = {
	ERROR_SELF: '^You can only demote up to your own rank!',
	errorLowest: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is already the lowest rank`,
	errorGm: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is the guild master so can't be demoted!`,
	success: (ign = IGN_DEFAULT, from = RANK_DEFAULT, to = RANK_DEFAULT) => `^${HYPIXEL_RANK}${ign} was demoted from ${from} to ${to}$`,
};
const promote = {
	ERROR_SELF: '^You can only promote up to your own rank!',
	errorHigest: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is already the highest rank`,
	errorGm: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is the guild master so can't be promoted anymore!`,
	success: (ign = IGN_DEFAULT, from = RANK_DEFAULT, to = RANK_DEFAULT) => `^${HYPIXEL_RANK}${ign} was promoted from ${from} to ${to}$`,
};
const mute = {
	ERROR_GM: '^You cannot mute the guild master!$',
	ERROR_SELF: '^You cannot mute yourself from the guild!$',
	success: (target = IGN_DEFAULT, executor = IGN_DEFAULT) => `^${HYPIXEL_RANK}${executor} has muted ${HYPIXEL_RANK}${target} for`,
};
const unmute = {
	ERROR_NOT_MUTED: '^(?:This player|The guild) is not muted!$',
	success: (target = IGN_DEFAULT, executor = IGN_DEFAULT) => `^${HYPIXEL_RANK}${executor} has unmuted ${HYPIXEL_RANK}${target}`,
};
const invite = {
	ERROR_PERMS: '^You do not have permission to invite players!$',
	ERROR_CANNOT_INVITE: '^You cannot invite this player to your guild!$', // g invites disabled
	// ERROR_GUILD_FULL: '', // guild is currently full
	successOnline: (ign = IGN_DEFAULT) => `^You invited ${HYPIXEL_RANK}${ign} to your guild\\. They have 5 minutes to accept\\.$`,
	successOffline: (ign = IGN_DEFAULT) => `^You sent an offline invite to ${HYPIXEL_RANK}${ign}! They will have 5 minutes to accept once they come online!$`,
	errorAlreadyInvited: (ign = IGN_DEFAULT) => `^You've already invited ${HYPIXEL_RANK}${ign} to your guild! Wait for them to accept!$`,
	errorInAnotherGuild: (ign = IGN_DEFAULT) => `^${HYPIXEL_RANK}${ign} is already in (?:another|your) guild!$`,
};

const demoteResponses = [
	...Object.values(demote),
	genericErrors.MUST_BE_GM,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
];
const promoteResponses = [
	...Object.values(promote),
	genericErrors.MUST_BE_GM,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
];
const setRankResponses = [
	...Object.values(demote),
	...Object.values(promote),
	genericErrors.MUST_BE_GM,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
	genericErrors.unknownRank,
];
const muteResponses = [
	...Object.values(mute),
	genericErrors.MUST_BE_GM,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
];
const unmuteResponses = [
	...Object.values(unmute),
	genericErrors.MUST_BE_GM,
	genericErrors.unknownIgn,
	genericErrors.playerNotInGuild,
];
const inviteResponses = [
	...Object.values(invite),
	genericErrors.MUST_BE_GM,
	genericErrors.unknownIgn,
];


module.exports = {
	commandResponses: {
		genericErrors,
		demote,
		promote,
		mute,
		unmute,
		invite,
	},

	commandResponsesRegExp: {
		demote: (ign = IGN_DEFAULT, from = RANK_DEFAULT, to = RANK_DEFAULT) => new RegExp(demoteResponses.map(x => (typeof x === 'function' ? x(ign, from, to) : x)).join('|'), 'i'),
		promote: (ign = IGN_DEFAULT, from = RANK_DEFAULT, to = RANK_DEFAULT) => new RegExp(promoteResponses.map(x => (typeof x === 'function' ? x(ign, from, to) : x)).join('|'), 'i'),
		setRank: (ign = IGN_DEFAULT, from = RANK_DEFAULT, to = RANK_DEFAULT) => new RegExp(setRankResponses.map(x => (typeof x === 'function' ? x(ign, from, to) : x)).join('|'), 'i'),
		mute: (target = IGN_DEFAULT, executor = IGN_DEFAULT) => new RegExp(muteResponses.map(x => (typeof x === 'function' ? x(target, executor) : x)).join('|'), 'i'),
		unmute: (target = IGN_DEFAULT, executor = IGN_DEFAULT) => new RegExp(unmuteResponses.map(x => (typeof x === 'function' ? x(target, executor) : x)).join('|'), 'i'),
		invite: (ign = IGN_DEFAULT) => new RegExp(inviteResponses.map(x => (typeof x === 'function' ? x(ign) : x)).join('|'), 'i'),
	},

	/**
	 * mc client version
	 */
	VERSION: '1.16.5',

	/**
	 * bot events that should only be listened to once
	 */
	spawnEvents: [
		'login',
		'update_health',
	],

	defaultSettings: {
		locale: 'en_US',
		viewDistance: 6, // tiny
		chatFlags: 0, // enabled
		chatColors: true,
		skinParts: 0,
		mainHand: 1,
	},

	messageTypes: {
		WHISPER: 'whisper',
		GUILD: 'guild',
		OFFICER: 'officer',
		PARTY: 'party',
	},

	HYPIXEL_RANK_REGEX: HYPIXEL_RANK,

	/**
	 * characters that don't render in mc chat
	 */
	invisibleCharacters: [
		'⭍',
		'ࠀ',
	],
};
