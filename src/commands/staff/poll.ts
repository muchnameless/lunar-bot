import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import ms from 'ms';
import { MESSAGE_TYPES } from '../../structures/chat_bridge/constants';
import { buildGuildOption } from '../../structures/commands/commonOptions';
import { ChannelUtil, InteractionUtil, MessageUtil, UserUtil } from '../../util';
import { minutes, seconds, stringToMS, upperCaseFirstChar } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction, GuildMember } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { ChatBridge } from '../../structures/chat_bridge/ChatBridge';


export default class PollCommand extends DualCommand {
	quoteChars = [ '\u{0022}', '\u{201C}', '\u{201D}' ] as const;

	constructor(context: CommandContext) {
		const slash = new SlashCommandBuilder()
			.setDescription('create a poll for both in game and discord guild chat')
			.addStringOption(option => option
				.setName('question')
				.setDescription('poll question')
				.setRequired(true),
			);

		// add choices
		for (let i = 1; i <= 10; ++i) {
			slash.addStringOption(option => option
				.setName(`choice_${i}`)
				.setDescription(`choice ${i}`)
				.setRequired(i <= 1),
			);
		}

		slash
			.addStringOption(option => option
				.setName('duration')
				.setDescription('s[econds] | m[inutes], must be between 30s and 10m')
				.setRequired(false),
			)
			.addStringOption(buildGuildOption(context.client));

		super(context, {
			aliases: [],
			slash,
			cooldown: seconds(1),
		}, {
			aliases: [],
			args: 1,
			usage: '<30s <= `duration` <= 10m> [`"question" "choice_1" "choice_2"` ...]',
		});
	}

	/**
	 * create a poll for both in game chat and the chatBridge channel
	 * @param param0
	 * @param param0.chatBridge
	 * @param param0.question
	 * @param param0.pollOptionNames
	 * @param param0.duration
	 * @param param0.ign
	 */
	async #run({ chatBridge, question, pollOptionNames, duration, ign }: { chatBridge: ChatBridge, question: string, pollOptionNames: string[], duration: string | null, ign: string }) {
		if (chatBridge.pollUntil) return `poll already in progress, ends ${Formatters.time(new Date(chatBridge.pollUntil), Formatters.TimestampStyles.RelativeTime)}`;

		try {
			const DURATION = typeof duration === 'string'
				? Math.min(Math.max(stringToMS(duration), seconds(30)), minutes(10)) || minutes(1)
				: minutes(1);

			chatBridge.pollUntil = Date.now() + DURATION;

			const pollOptions = pollOptionNames.map((name, index) => ({ number: index + 1, option: name.trim(), votes: new Set<string>() }));
			const optionsCount = pollOptions.length;
			const hypixelMessages: Promise<HypixelMessage<true>[]> = chatBridge.minecraft.awaitMessages({
				filter: hypixelMessage => hypixelMessage.isUserMessage() && hypixelMessage.type === MESSAGE_TYPES.GUILD,
				time: DURATION,
			});
			const discordChannel = chatBridge.discord.get(MESSAGE_TYPES.GUILD)!.channel;
			const discordMessages = discordChannel.awaitMessages({
				filter: discordMessage => MessageUtil.isUserMessage(discordMessage),
				time: DURATION,
			});

			// post message to both chats
			chatBridge.broadcast(stripIndents`
				poll by ${ign}: type a number to vote (${ms(DURATION, { long: true })})
				${question}
				${pollOptions.map(({ number, option }) => `${number}: ${option}`).join('\n')}
			`);

			// aquire in game votes
			for (const msg of await hypixelMessages) {
				const votedFor = Number.parseInt(msg.content, 10);

				// doesn't start with a number or out of range
				if (Number.isNaN(votedFor) || votedFor < 1 || votedFor > optionsCount) continue;

				pollOptions[votedFor - 1].votes.add(msg.player?.minecraftUuid ?? msg.author.ign);
			}

			// aquire discord votes
			for (const msg of (await discordMessages).values()) {
				const votedFor = Number.parseInt(msg.content, 10);

				// doesn't start with a number or out of range
				if (Number.isNaN(votedFor) || votedFor < 1 || votedFor > optionsCount) continue;

				pollOptions[votedFor - 1].votes.add(UserUtil.getPlayer(msg.author)?.minecraftUuid ?? msg.author.id);
			}

			// count votes and sort options by them
			const result = pollOptions
				.map(({ votes, ...rest }) => ({ votes: votes.size, ...rest }))
				.sort(({ votes: votesA }, { votes: votesB }) => votesB - votesA);
			const TOTAL_VOTES = result.reduce((acc, { votes }) => acc + votes, 0);
			const resultString = result.map(({ number, option, votes }) => `#${number}: ${option} (${Math.round(votes / TOTAL_VOTES * 100) || 0}%, ${votes} vote${votes === 1 ? '' : 's'})`);

			// reply with result
			ChannelUtil.send(discordChannel, {
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
				maxParts: Number.POSITIVE_INFINITY,
			});
		} finally {
			chatBridge.pollUntil = null; // unlock poll command
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		InteractionUtil.deferReply(interaction, {
			ephemeral: true,
		});

		const result = await this.#run({
			chatBridge: InteractionUtil.getHypixelGuild(interaction).chatBridge,
			question: interaction.options.getString('question', true),
			pollOptionNames: interaction.options
				// @ts-expect-error
				._hoistedOptions
				.filter(({ name }) => name.startsWith('choice_')).map(({ value }) => value as string),
			duration: interaction.options.getString('duration'),
			ign: UserUtil.getPlayer(interaction.user)?.ign ?? (interaction.member as GuildMember)?.displayName ?? interaction.user.tag,
		});

		return InteractionUtil.reply(interaction, {
			content: result ?? 'poll complete',
			ephemeral: true,
		});
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelMessage<true>) {
		const inputMatched = hypixelMessage.content
			.match(new RegExp(`(?<=[${this.quoteChars.join('')}]).+?(?=[${this.quoteChars.join('')}])`, 'g'))
			?.flatMap((x) => {
				const input = x.trim();
				if (!input.length) return [];
				return input;
			});

		if (!inputMatched || inputMatched.length < 2) return hypixelMessage.reply(this.usageInfo);

		const result = await this.#run({
			chatBridge: hypixelMessage.chatBridge,
			question: upperCaseFirstChar(inputMatched.shift()!),
			pollOptionNames: inputMatched,
			duration: hypixelMessage.commandData.args[0],
			ign: hypixelMessage.author.ign,
		});

		if (result) return hypixelMessage.author.send(result);
	}
}
