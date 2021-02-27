'use strict';

const { MessageEmbed } = require('discord.js');
const ms = require('ms');
const { messageTypes: { GUILD, WHISPER } } = require('../../../../constants/chatBridge');
const IngameCommand = require('../../IngameCommand');
const logger = require('../../../../functions/logger');


module.exports = class PollCommand extends IngameCommand {
	constructor(data) {
		super(data, {
			aliases: [ 'polls' ],
			description: '',
			args: false,
			usage: '<\'time\'> ["option1" "option2" ...]',
			cooldown: 30,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../../LunarClient')} client
	 * @param {import('../../../database/ConfigHandler')} config
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const duration = ms(args[0]) ?? 60_000;
		const startingIndex = message.content.indexOf('"');

		// no '"' found
		if (startingIndex === -1) return message.reply('specify poll options to vote for');

		const options = message.content
			.slice(startingIndex)
			.split('"')
			.map(x => x.trim())
			.filter(x => x.length)
			.map(x => ({ option: x, votes: new Set() }));
		const optionsCount = options.length;

		// post message to both chats
		await message.chatBridge.broadcast(`poll by ${message.author.ign}: \n${options.map(({ option }, index) => `${index + 1}: ${option}`).join('; \n')}`);

		// get votes from both chats
		const [ ingameMessages, discordMessages ] = await Promise.all([
			message.chatBridge.awaitMessages(
				msg => msg.type === GUILD || msg.type === WHISPER,
				{ time: duration },
			),
			message.chatBridge.channel.awaitMessages(
				msg => msg.isUserMessage,
				{ time: duration },
			),
		]);

		// aquire ingame votes
		for (const msg of ingameMessages) {
			if (/\D/.test(msg.content)) continue;

			const votedFor = Number(msg.content);

			if (votedFor < 1 || votedFor > optionsCount) continue;

			options[votedFor - 1].votes.add(msg.player?.minecraftUUID ?? msg.author.ign);
		}

		// aquire discord votes
		for (const msg of discordMessages) {
			if (/\D/.test(msg.content)) continue;

			const votedFor = Number(msg.content);

			if (votedFor < 1 || votedFor > optionsCount) continue;

			options[votedFor - 1].votes.add(msg.author.player?.minecraftUUID ?? msg.author.id);
		}

		// count votes and sort options by them
		const result = options
			.map(({ option, votes }) => ({ option, votes: votes.size }))
			.sort((a, b) => b.votes - a.votes);
		const TOTAL_VOTES = result.reduce((acc, { votes }) => acc + votes, 0);
		const resultString = result.map(({ option, votes }, index) => `#${index + 1}: ${option} (${Math.round(votes / TOTAL_VOTES * 100)}%, ${votes} vote${votes === 1 ? '' : 's'})`);

		// reply with result
		message.chatBridge.channel.send(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle(`Poll by ${message.author.ign} - Result`)
			.setDescription(resultString.join('\n\n'))
			.setTimestamp(),
		);

		message.chatBridge.gchat(resultString.join('; \n\n'));
	}
};
