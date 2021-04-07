'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');
const ms = require('ms');
const { upperCaseFirstChar, stringToMS } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class PollCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'polls' ],
			description: 'create a poll for both ingame and discord guild chat',
			args: true,
			usage: '<30s <= `duration` <= 10m> [`"question" "option1" "option2"` ...]',
			cooldown: 1,
		});
	}

	/**
	 * create a poll for both ingame chat and the chatBridge channel
	 * @param {import('../../structures/chat_bridge/ChatBridge')} chatBridge
	 * @param {import('../../structures/chat_bridge/HypixelMessage')|import('../../structures/extensions/Message')}
	 * @param {string[]} args
	 * @param {string} ign
	 */
	async createPoll(chatBridge, message, args, ign) {
		if (chatBridge.pollUntil) return message.reply(`poll already in progress, wait ${ms(chatBridge.pollUntil - Date.now(), { long: true })} until it ends`);

		try {
			const duration = Math.min(Math.max(stringToMS(args[0]), 30_000), 10 * 60_000) || 60_000;

			chatBridge.pollUntil = Date.now() + duration;

			const quoteChars = [ '\u{0022}', '\u{201C}', '\u{201D}' ];
			const STARTING_INDEX = quoteChars.reduce((acc, cur) => {
				const CUR_INDEX = message.content.indexOf(cur);
				return Math.min(acc, CUR_INDEX === -1 ? Infinity : CUR_INDEX);
			}, Infinity);

			// no quote found
			if (!Number.isFinite(STARTING_INDEX)) return message.reply('specify poll options to vote for');

			let options = message.content
				.slice(STARTING_INDEX)
				.split(new RegExp(quoteChars.join('|'), 'u'))
				.map(x => x.trim())
				.filter(({ length }) => length);

			const question = upperCaseFirstChar(options.shift());

			if (!options.length) return message.reply('specify poll options to vote for');

			options = options.map(x => ({ option: x, votes: new Set() }));

			const optionsCount = options.length;
			const ingameMessages = chatBridge.awaitMessages(
				msg => msg.isUserMessage,
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
				.setColor(this.client.config.get('EMBED_BLUE'))
				.setTitle(question)
				.setDescription(resultString.join('\n\n'))
				.setFooter(`Poll by ${ign}`)
				.setTimestamp(),
			);

			resultString.unshift(question);
			chatBridge.gchat(resultString.join('\n'), { maxParts: Infinity });
		} finally {
			chatBridge.pollUntil = null; // unlock poll command
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(flags) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		this.createPoll(hypixelGuild.chatBridge, message, args, message.author.player.ign);
	}
};
