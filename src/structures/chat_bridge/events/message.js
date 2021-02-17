'use strict';

const { Util, DiscordAPIError } = require('discord.js');
const { nameToUnicode } = require('../../../constants/emojiNameUnicodeConverter');
const logger = require('../../../functions/logger');

/**
 * @typedef {object} TextComponent
 * @property {object} json
 * @property {string} text
 * @property {any[]} extra
 * @property {*} bold
 * @property {*} italic
 * @property {*} underlined
 * @property {*} strikethrough
 * @property {*} obfuscated
 * @property {string} color
 */

/**
 * @typedef {string} ChatPosition
 * * `chat`
 * * `system`
 * * `game_info`
 */

/**
 * @param {import('../../LunarClient')} client
 * @param {import('mineflayer').Bot} bot
 * @param {TextComponent[]} jsonMsg chat message from the server
 * @param {ChatPosition} position
 */
module.exports = async (client, bot, jsonMsg, position) => {
	if (!client.config.getBoolean('CHATBRIDGE_ENABLED')) return;

	const message = jsonMsg.toString().trim();

	if (client.config.getBoolean('EXTENDED_LOGGING')) logger.debug({ position, message });


	// non player message
	if (!message.includes(':')) {
		// accept f reqs from guild members
		const matched = message.match(/Friend request from (?:\[.+\+*\] )?(\w+)/);

		if (!matched) return;

		const [, ign ] = matched;
		const player = client.players.cache.find(p => p.ign === ign);

		if (!player?.guildID) return;

		logger.info(`[CHATBRIDGE MESSAGE]: accepting f request from ${ign}`);
		return bot.chat(`/f add ${ign}`);
	}


	const messageParts = message.split(':');
	const sender = messageParts.shift().replace(/§./g, '').trim(); // remove mc-chat markdown

	let content = messageParts.join(':').replace(/ࠀ|⭍/g, '').trim();

	if (client.config.getBoolean('EXTENDED_LOGGING')) logger.debug({ sender, content });

	if (!content.length) return;


	// guild message
	const guildMatch = sender.match(/^Guild > (?:\[.+\+*\] )?(\w+)(?: \[\w+\])?/); // 'Guild > [HypixelRank] ign [GuildRank]'

	if (guildMatch) {
		const [, ign ] = guildMatch;

		if (ign === bot.username) return; // ignore own messages

		// prettify message for discord, try to replace :emoji: and others with the actually working discord render string
		content = Util.escapeMarkdown(content)
			.replace(/:(.+):/, (match, p1) => client.emojis.cache.find(e => e.name.toLowerCase() === p1.toLowerCase())?.toString() ?? nameToUnicode[p1] ?? match) // emojis (custom and default)
			.replace(/<?#([a-z-]+)>?/gi, (match, p1) => client.channels.cache.find(ch => ch.name === p1.toLowerCase())?.toString() ?? match) // channels
			.replace(/<?@[!&]?(\S+)>?/g, (match, p1) =>
				client.lgGuild?.members.cache.find(m => m.displayName.toLowerCase() === p1.toLowerCase())?.toString() // members
				?? client.users.cache.find(u => u.username.toLowerCase() === p1.toLowerCase())?.toString() // users
				?? client.lgGuild?.roles.cache.find(r => r.name.toLowerCase() === p1.toLowerCase())?.toString() // roles
				?? match,
			);

		const player = client.players.cache.find(p => p.ign === ign);
		const member = await player?.discordMember;

		if (!client.chatBridge.webhook) return logger.warn('[CHATBRIDGE]: webhook unavailable');

		try {
			await client.chatBridge.webhook.send({
				username: member?.displayName ?? player?.ign ?? ign ?? client.user.username,
				avatarURL: member?.user.displayAvatarURL({ dynamic: true }) ?? player?.image ?? client.user.displayAvatarURL({ dynamic: true }),
				content,
				allowedMentions: { parse: player?.hasDiscordPingPermission ? [ 'users' ] : [] },
			});
		} catch (error) {
			if (error instanceof DiscordAPIError && error.method === 'get' && error.code === 0 && error.httpStatus === 404) client.config.set('CHATBRIDGE_WEBHOOK_DELETED', 'true');
			logger.error(`[CHATBRIDGE DC CHAT]: ${error.name}: ${error.message}`);
		}

		return;
	}


	// whisper message
	const whisperMatch = sender.match(/^From (?:\[.+\+*\] )?(\w+)/); // 'From [HypixelRank] ign'

	if (whisperMatch) {
		const [, ign ] = whisperMatch;

		if (client.config.getBoolean('EXTENDED_LOGGING')) logger.debug(`[CHATBRIDGE DC CHAT]: whisper from ${ign}`);
	}
};
