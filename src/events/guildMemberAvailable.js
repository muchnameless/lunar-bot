'use strict';

// const logger = require('../functions/logger');


/**
 * guildMemberAvailable
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/GuildMember')} newMember
 */
module.exports = async (client, newMember) => {
	if (newMember.guild.id !== client.config.get('DISCORD_GUILD_ID')) return;

	const { player } = newMember;

	if (!player) return;

	player.discordMember = newMember;
};
