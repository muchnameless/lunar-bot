'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');
const ms = require('ms');
const { messageTypes: { GUILD, WHISPER } } = require('../constants/chatBridge');
const { upperCaseFirstChar, stringToMS } = require('./util');
// const logger = require('./logger');


/**
 * create a poll for both ingame chat and the chatBridge channel
 * @param {import('../structures/chat_bridge/ChatBridge')} chatBridge
 * @param {import('../structures/chat_bridge/HypixelMessage')|import('../structures/extensions/Message')}
 * @param {string[]} args
 * @param {string} ign
 */
module.exports = async (chatBridge, message, args, ign) => {
	const duration = Math.min(Math.max(stringToMS(args[0]), 30_000), 10 * 60_000) || 60_000;
	const QUOTE_1_INDEX = message.content.indexOf('"');
	const QUOTE_2_INDEX = message.content.indexOf('“');
	const QUOTE_3_INDEX = message.content.indexOf('”');
	const startingIndex = Math.min(
		QUOTE_1_INDEX === -1 ? Infinity : QUOTE_1_INDEX,
		QUOTE_2_INDEX === -1 ? Infinity : QUOTE_2_INDEX,
		QUOTE_3_INDEX === -1 ? Infinity : QUOTE_3_INDEX,
	);

	// no quote found
	if (!Number.isFinite(startingIndex)) return message.reply('specify poll options to vote for');

	let options = message.content
		.slice(startingIndex)
		.split(/"|“|”/)
		.map(x => x.trim())
		.filter(x => x.length);

	const question = upperCaseFirstChar(options.shift());

	options = options.map(x => ({ option: x, votes: new Set() }));

	const optionsCount = options.length;
	const ingameMessages = chatBridge.awaitMessages(
		msg => (msg.type === GUILD || msg.type === WHISPER) && msg.author.ign !== chatBridge.bot.username,
		{ time: duration },
	);
	const discordMessages = chatBridge.channel.awaitMessages(
		msg => msg.isUserMessage,
		{ time: duration },
	);

	// post message to both chats
	chatBridge.broadcast(stripIndents`
		poll by ${ign}: type a number to vote (${ms(duration, { long: true })})
		${question}
		${options.map(({ option }, index) => `${index + 1}: ${option}`).join('\n')}
	`);

	// aquire ingame votes
	for (const msg of await ingameMessages) {
		const votedFor = parseInt(msg.content, 10);

		// doesn't start with a number or out of range
		if (Number.isNaN(votedFor) || votedFor < 1 || votedFor > optionsCount) continue;

		options[votedFor - 1].votes.add(msg.player?.minecraftUUID ?? msg.author.ign);
	}

	// aquire discord votes
	for (const msg of (await discordMessages).values()) {
		const votedFor = parseInt(msg.content, 10);

		// doesn't start with a number or out of range
		if (Number.isNaN(votedFor) || votedFor < 1 || votedFor > optionsCount) continue;

		options[votedFor - 1].votes.add(msg.author.player?.minecraftUUID ?? msg.author.id);
	}

	// count votes and sort options by them
	const result = options
		.map(({ option, votes }) => ({ option, votes: votes.size }))
		.sort((a, b) => b.votes - a.votes);
	const TOTAL_VOTES = result.reduce((acc, { votes }) => acc + votes, 0);
	const resultString = result.map(({ option, votes }, index) => `#${index + 1}: ${option} (${Math.round(votes / TOTAL_VOTES * 100) || 0}%, ${votes} vote${votes === 1 ? '' : 's'})`);

	// reply with result
	chatBridge.channel.send(new MessageEmbed()
		.setColor(chatBridge.client.config.get('EMBED_BLUE'))
		.setTitle(question)
		.setDescription(resultString.join('\n\n'))
		.setFooter(`Poll by ${ign}`)
		.setTimestamp(),
	);

	resultString.unshift(question);
	chatBridge.gchat(resultString.join('\n'), { maxParts: Infinity });
};
