'use strict';

const { Util } = require('discord.js');
const logger = require('../../../functions/logger');


/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 * @param {string} username ign of the chat message
 * @param {string} message chat message
 */
module.exports = async (client, bot, username, message, translate, jsonMessage, matches) => {
	if (!client.config.getBoolean('CHATBRIDGE_ENABLED')) return;
	if (username === bot.username) return; // ignore own messages (1/2)

	/**
	 * @type {string}
	 */
	const chatMessage = jsonMessage.extra.map(x => x.text).join('').trim();

	if (!chatMessage.includes(':')) return; // non-player message

	const messageParts = chatMessage.split(':');
	const sender = messageParts.shift().replace(/§./g, '').trim(); // remove mc-chat markdown

	if (!sender.startsWith('Guild >')) return;

	const [, ign ] = sender.match(/^Guild > (?:\[\w+\+*\] )?(\w+)(?: \[\w+\])?/); // 'Guild > [HypixelRank] ign [GuildRank]'

	if (ign === bot.username) return; // ignore own messages (2/2)

	let content = Util.escapeMarkdown(messageParts.join(':').replace(/ࠀ|⭍/g, '').trim()); // prettify message for discord

	// try to replace :emoji: with the correct discord render string
	content = content.replace(/:(.+):/, (_, p1) => client.emojis.cache.find(e => e.name.toLowerCase() === p1.toLowerCase())?.toString() ?? '$&');

	if (!content.length) return;

	const player = client.players.cache.find(p => p.ign === ign);
	const member = await player?.discordMember;

	try {
		await client.chatBridge.webhook?.send({
			username: member?.displayName ?? player?.ign ?? ign ?? client.user.username,
			avatarURL: member?.user.displayAvatarURL({ dynamic: true }) ?? player?.image ?? client.user.displayAvatarURL({ dynamic: true }),
			content,
			allowedMentions: { parse: [] },
		});
	} catch (error) {
		logger.error(`[CHATBRIDGE DC CHAT]: ${error.name}: ${error.message}`);
	}
};
