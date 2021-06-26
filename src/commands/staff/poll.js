'use strict';

const { Constants } = require('discord.js');
const { stripIndents } = require('common-tags');
const ms = require('ms');
const { upperCaseFirstChar, stringToMS } = require('../../functions/util');
const { messageTypes: { GUILD } } = require('../../structures/chat_bridge/constants/chatBridge');
const LunarCommandInteraction = require('../../structures/extensions/CommandInteraction');
const DualCommand = require('../../structures/commands/DualCommand');
// const logger = require('../../functions/logger');


module.exports = class PollCommand extends DualCommand {
	constructor(data) {
		const options = [{
			name: 'question',
			type: Constants.ApplicationCommandOptionTypes.STRING,
			description: 'poll question',
			required: true,
		}];

		// add choices
		for (let i = 1; i <= 10; ++i) {
			options.push({
				name: `choice_${i}`,
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: `choice ${i}`,
				required: i <= 1,
			});
		}

		options.push(
			{
				name: 'duration',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'number of s[econds] | m[inutes], must be between 30s and 10m',
				required: false,
			},
			DualCommand.guildOptionBuilder(data.client),
		);

		super(
			data,
			{
				aliases: [],
				description: 'create a poll for both in game and discord guild chat',
				options,
				defaultPermission: true,
				cooldown: 1,
			},
			{
				aliases: [],
				args: true,
				usage: '<30s <= `duration` <= 10m> [`"question" "choice_1" "choice_2"` ...]',
			},
		);

		this.quoteChars = [ '\u{0022}', '\u{201C}', '\u{201D}' ];
	}

	/**
	 * create a poll for both ingame chat and the chatBridge channel
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {object} param1
	 * @param {import('../../structures/chat_bridge/ChatBridge')} param1.chatBridge
	 * @param {string} param1.question
	 * @param {string[]} param1.pollOptionNames
	 * @param {number} param1.duration
	 * @param {string} param1.ign
	 */
	async _run(ctx, { chatBridge, question, pollOptionNames, duration, ign }) {
		if (chatBridge.pollUntil) return ctx.reply(`poll already in progress, wait ${ms(chatBridge.pollUntil - Date.now(), { long: true })} until it ends`);

		try {
			const DURATION = duration
				? Math.min(Math.max(stringToMS(duration), 30_000), 10 * 60_000) || 60_000
				: 60_000;

			chatBridge.pollUntil = Date.now() + Math.min(Math.max(DURATION, 30_000), 10 * 60_000);

			if (ctx instanceof LunarCommandInteraction) ctx.reply({
				content: 'poll started',
				ephemeral: true,
			});

			/** @type {{ number: number, option: string, votes: Set<string> }[]} */
			const pollOptions = pollOptionNames.map((name, index) => ({ number: index + 1, option: name.trim(), votes: new Set() }));
			const optionsCount = pollOptions.length;
			const ingameMessages = chatBridge.minecraft.awaitMessages({
				filter: msg => msg.isUserMessage && msg.type === GUILD,
				time: DURATION,
			});
			const discordChannel = chatBridge.discord.get(GUILD).channel;
			const discordMessages = discordChannel.awaitMessages({
				filter: msg => msg.isUserMessage,
				time: DURATION,
			});

			// post message to both chats
			chatBridge.broadcast(stripIndents`
				poll by ${ign}: type a number to vote (${ms(DURATION, { long: true })})
				${question}
				${pollOptions.map(({ number, option }) => `${number}: ${option}`).join('\n')}
			`);

			// aquire ingame votes
			for (const msg of await ingameMessages) {
				const votedFor = parseInt(msg.content, 10);

				// doesn't start with a number or out of range
				if (Number.isNaN(votedFor) || votedFor < 1 || votedFor > optionsCount) continue;

				pollOptions[votedFor - 1].votes.add(msg.player?.minecraftUUID ?? msg.author.ign);
			}

			// aquire discord votes
			for (const msg of (await discordMessages).values()) {
				const votedFor = parseInt(msg.content, 10);

				// doesn't start with a number or out of range
				if (Number.isNaN(votedFor) || votedFor < 1 || votedFor > optionsCount) continue;

				pollOptions[votedFor - 1].votes.add(msg.author.player?.minecraftUUID ?? msg.author.id);
			}

			// count votes and sort options by them
			const result = pollOptions
				.map(({ votes, ...rest }) => ({ votes: votes.size, ...rest }))
				.sort(({ votes: votesA }, { votes: votesB }) => votesB - votesA);
			const TOTAL_VOTES = result.reduce((acc, { votes }) => acc + votes, 0);
			const resultString = result.map(({ number, option, votes }) => `#${number}: ${option} (${Math.round(votes / TOTAL_VOTES * 100) || 0}%, ${votes} vote${votes === 1 ? '' : 's'})`);

			// reply with result
			discordChannel.send({
				embeds: [
					this.client.defaultEmbed
						.setTitle(question)
						.setDescription(resultString.join('\n\n'))
						.setFooter(`Poll by ${ign}`),
				],
			});

			resultString.unshift(question);

			chatBridge.minecraft.gchat({
				content: resultString.join('\n'),
				maxParts: Infinity,
			});
		} finally {
			chatBridge.pollUntil = null; // unlock poll command
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer({
			ephemeral: true,
		});

		await this._run(
			interaction,
			{
				chatBridge: this.getHypixelGuild(interaction.options, interaction).chatBridge,
				question: interaction.options.get('question').value,
				pollOptionNames: interaction.options.filter(({ name }) => name.startsWith('choice_')).map(({ value }) => value),
				duration: interaction.options.get('duration')?.value,
				ign: interaction.user.player?.ign ?? interaction.member?.displayName ?? interaction.user.tag,
			},
		);

		return interaction.reply({
			content: 'poll complete',
			ephemeral: true,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		const inputMatched = message.content
			.match(new RegExp(`(?<=[${this.quoteChars.join('')}]).+?(?=[${this.quoteChars.join('')}])`, 'g'))
			?.flatMap((x) => {
				const input = x.trim();
				if (!input.length) return [];
				return input;
			});

		if (!inputMatched || inputMatched.length < 2) return message.reply(this.inGameData.usageInfo);

		return this._run(
			message,
			{
				chatBridge: message.chatBridge,
				question: upperCaseFirstChar(inputMatched.shift()),
				pollOptionNames: inputMatched,
				duration: args[0],
				ign: message.author.ign,
			},
		);
	}
};
