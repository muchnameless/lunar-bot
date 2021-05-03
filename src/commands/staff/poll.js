'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndents } = require('common-tags');
const ms = require('ms');
const { upperCaseFirstChar, stringToMS } = require('../../functions/util');
const { messageTypes: { GUILD } } = require('../../structures/chat_bridge/constants/chatBridge');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class PollCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'polls' ],
			description: 'create a poll for both ingame and discord guild chat',
			args: true,
			usage: '<30s <= `duration` <= 10m> [`"question" "option1" "option2"` ...]',
			cooldown: 1,
		});

		this.quoteChars = [ '\u{0022}', '\u{201C}', '\u{201D}' ];
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

			const inputMatched = message.content
				.match(new RegExp(`(?<=[${this.quoteChars.join('')}]).+?(?=[${this.quoteChars.join('')}])`, 'g'))
				?.flatMap((x) => {
					const input = x.trim();
					if (!input.length) return [];
					return input;
				});

			if (!inputMatched?.length) return message.reply(this.usageInfo);

			const question = upperCaseFirstChar(inputMatched.shift());
			/** @type {{number:number,option:string,votes:Set<string>}[]} */
			const options = inputMatched.map((x, index) => ({ number: index + 1, option: x.trim(), votes: new Set() }));

			if (!options.length) return message.reply('specify poll options to vote for');

			const optionsCount = options.length;
			const ingameMessages = chatBridge.minecraft.awaitMessages(
				msg => msg.isUserMessage && msg.type === GUILD,
				{ time: duration },
			);
			const discordChannel = chatBridge.discord.get(GUILD).channel;
			const discordMessages = discordChannel.awaitMessages(
				msg => msg.isUserMessage,
				{ time: duration },
			);

			// post message to both chats
			chatBridge.broadcast(stripIndents`
				poll by ${ign}: type a number to vote (${ms(duration, { long: true })})
				${question}
				${options.map(({ number, option }) => `${number}: ${option}`).join('\n')}
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
				.map(({ votes, ...rest }) => ({ votes: votes.size, ...rest }))
				.sort(({ votes: votesA }, { votes: votesB }) => votesB - votesA);
			const TOTAL_VOTES = result.reduce((acc, { votes }) => acc + votes, 0);
			const resultString = result.map(({ number, option, votes }) => `#${number}: ${option} (${Math.round(votes / TOTAL_VOTES * 100) || 0}%, ${votes} vote${votes === 1 ? '' : 's'})`);

			// reply with result
			discordChannel.send(new MessageEmbed()
				.setColor(this.client.config.get('EMBED_BLUE'))
				.setTitle(question)
				.setDescription(resultString.join('\n\n'))
				.setFooter(`Poll by ${ign}`)
				.setTimestamp(),
			);

			resultString.unshift(question);
			chatBridge.minecraft.gchat(resultString.join('\n'), { maxParts: Infinity });
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
