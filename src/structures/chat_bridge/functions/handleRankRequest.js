'use strict';

const { Y_EMOJI, X_EMOJI, CLOWN } = require('../../../constants/emojiCharacters');
const { commandResponses: { promote: { success } } } = require('../../../constants/chatBridge');
const { autocorrect } = require('../../../functions/util');
const logger = require('../../../functions/logger');


/**
 * checks ingame messages for rank requests
 * @param {import('../HypixelMessage')} message
 */
module.exports = async (message) => {
	const { chatBridge, chatBridge: { guild, client, client: { config } }, content } = message;
	const result = content
		?.replace(/[^a-zA-Z ]/g, '') // delete all non alphabetical characters
		.split(/ +/)
		.filter(word => word.length >= 3) // filter out short words like 'am'
		.map(word => autocorrect(word, guild.ranks, 'name'))
		.sort((a, b) => b.similarity - a.similarity)[0]; // element with the highest similarity

	if (!result || result.similarity < config.get('AUTOCORRECT_THRESHOLD')) return;

	const { value: {
		name: RANK_NAME,
		weightReq: WEIGHT_REQ,
		roleID: ROLE_ID,
		priority: RANK_PRIORITY,
	} } = result; // rank

	let player = guild.players.find(p => p.ign === message.author.ign);

	// no player db entry in this guild
	if (!player) {
		({ player } = message.author);

		// no player db entry in all guilds
		if (!player) {
			logger.info(`[RANK REQUEST]: ${message.author.ign} | ${guild.name}: requested '${RANK_NAME}' but could not be found in the player db`);

			return message.reply(`unable to find you in the ${guild.name} player database, use '${config.get('PREFIX')}verify [your ign]' in #bot-commands ('/g discord' for the invite)`);
		}

		// player found in other guild
		logger.info(`[RANK REQUEST]: ${player.logInfo}: requested '${RANK_NAME}' from '${guild.name}' but is in '${player.guildName}'`);

		return message.reply(`you need to be in ${guild.name} in order to request this rank. If you just joined use '${config.get('PREFIX')}verify [your ign]' in #bot-commands ('/g discord' for the invite)`);
	}

	// non-requestable rank
	if (!ROLE_ID) {
		logger.info(`[RANK REQUEST]: ${player.logInfo}: requested '${RANK_NAME}' rank which is non-requestable`);
		return message.reply(CLOWN);
	}

	const WEIGHT_REQ_STRING = client.formatNumber(WEIGHT_REQ);

	let { totalWeight } = player.getWeight();

	// player data could be outdated -> update data when player does not meet reqs
	if (totalWeight < WEIGHT_REQ) {
		logger.info(`[RANK REQUEST]: ${player.logInfo}: requested ${RANK_NAME} but only had ${client.formatDecimalNumber(totalWeight)} / ${WEIGHT_REQ_STRING} weight -> updating db`);
		await player.updateXp({ shouldSkipQueue: true });
		({ totalWeight } = player.getWeight());
	}

	const WEIGHT_STRING = client.formatDecimalNumber(totalWeight);

	await message.reply(`${totalWeight >= WEIGHT_REQ ? Y_EMOJI : X_EMOJI} your weight: ${WEIGHT_STRING} / ${WEIGHT_REQ_STRING} [${RANK_NAME}]`);

	logger.info(`[RANK REQUEST]: ${player.logInfo}: requested ${RANK_NAME} rank with ${WEIGHT_STRING} / ${WEIGHT_REQ_STRING} weight`);

	// player doesn't meet reqs or meets reqs and already has the rank or is staff and has the rank's role
	if (totalWeight < WEIGHT_REQ || (totalWeight >= WEIGHT_REQ && ((!player.isStaff && player.guildRankPriority >= RANK_PRIORITY) || (player.isStaff && (await player.discordMember)?.roles.cache.has(ROLE_ID))))) return;

	// set rank role to requested rank
	if (player.isStaff) {
		const discordMember = await player.discordMember;

		if (!discordMember) throw new Error('unknown discord member');

		const otherRequestableRankRoles = guild.ranks.flatMap(({ roleID }) => (roleID && roleID !== ROLE_ID ? roleID : []));
		const rolesToRemove = [ ...discordMember.roles.cache.keys() ].filter(roleID => otherRequestableRankRoles.includes(roleID));

		await player.makeRoleApiCall([ ROLE_ID ], rolesToRemove, `requested ${RANK_NAME}`);

	// set ingame rank and discord role
	} else {
		await chatBridge.command({
			command: `g setrank ${player.ign} ${RANK_NAME}`,
			responseRegex: new RegExp(success(player.ign, player.guildRank?.name, RANK_NAME), 'i'), // listen for successful ingame promotion message
			rejectOnTimeout: true,
		});

		// ingame chat message received
		player.guildRankPriority = RANK_PRIORITY;
		player.save();
		await player.updateRoles(`requested ${RANK_NAME}`);
	}
};
