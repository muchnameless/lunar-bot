'use strict';

const logger = require('../functions/logger');


module.exports = async (client, reaction, user) => {
	if (!client.config.getBoolean('EXTENDED_LOGGING')) return;

	try {
		if (reaction.message.partial) await reaction.message.fetch();
		if (reaction.partial) await reaction.fetch();
	} catch (error) {
		return logger.error('[MESSAGE REACTION REMOVE]: error while fetching partial', error);
	}

	if (user.id === client.user.id || reaction.message.author.id !== client.user.id) return; // ignore own reactions and on not owned messages

	const { message } = reaction;

	if (!message.guild || !message.embeds.length) return;

	const MEMBER_WHO_REACTED = await message.guild.members.fetch(user.id);

	logger.debug(`[EVENT]: ${user.tag} | ${MEMBER_WHO_REACTED.displayName} unreacted with ${reaction.emoji.name}`);
};
