import { SlashCommandBuilder, time, TimestampStyles } from 'discord.js';
import { stripIndents } from 'common-tags';
import ms from 'ms';
import { ChannelUtil, InteractionUtil, MessageUtil, UserUtil } from '#utils';
import { INVISIBLE_CHARACTERS, HypixelMessageType } from '#chatBridge/constants';
import { hypixelGuildOption } from '#structures/commands/commonOptions';
import { DualCommand } from '#structures/commands/DualCommand';
import { escapeIgn, minutes, seconds, stringToMS, upperCaseFirstChar } from '#functions';
import type { ChatInputCommandInteraction, CommandInteractionOption } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';
import type { ChatBridge } from '#chatBridge/ChatBridge';

interface RunOptions {
	chatBridge: ChatBridge;
	question: string;
	pollOptionNames: string[];
	duration?: string | null;
	ign: string;
}

export default class PollCommand extends DualCommand {
	/**
	 * currently running polls
	 */
	polls = new Map<ChatBridge, number>();

	constructor(context: CommandContext) {
		const slash = new SlashCommandBuilder()
			.setDescription('create a poll for both in-game and discord guild chat')
			.addStringOption((option) =>
				option //
					.setName('question')
					.setDescription('poll question')
					.setRequired(true),
			);

		// add choices
		for (let i = 1; i <= 10; ++i) {
			slash.addStringOption((option) =>
				option
					.setName(`choice_${i}`)
					.setDescription(`choice ${i}`)
					.setRequired(i <= 1),
			);
		}

		slash
			.addStringOption((option) =>
				option
					.setName('duration')
					.setDescription('s[econds] | m[inutes], must be between 30s and 10m')
					.setRequired(false),
			)
			.addStringOption(hypixelGuildOption);

		super(
			context,
			{
				slash,
				cooldown: seconds(1),
			},
			{
				args: 1,
				usage: '<30s <= `duration` <= 10m> [`"question" "choice_1" "choice_2"` ...]',
			},
		);
	}

	/**
	 * create a poll for both in-game chat and the chatBridge channel
	 * @param options
	 */
	private async _sharedRun({ chatBridge, question, pollOptionNames, duration, ign }: RunOptions) {
		if (this.polls.has(chatBridge)) {
			return `poll already in progress, ends ${time(this.polls.get(chatBridge)!, TimestampStyles.RelativeTime)}`;
		}

		try {
			const DURATION =
				typeof duration === 'string'
					? Math.min(Math.max(stringToMS(duration), seconds(30)), minutes(10)) || minutes(1)
					: minutes(1);

			this.polls.set(chatBridge, Date.now() + DURATION);

			const pollOptions = pollOptionNames.map((name, index) => ({
				number: index + 1,
				option: name.trim(),
				votes: new Set<string>(),
			}));
			const optionsCount = pollOptions.length;
			const hypixelMessages = chatBridge.minecraft.awaitMessages({
				filter: (hypixelMessage) => hypixelMessage.isUserMessage() && hypixelMessage.type === HypixelMessageType.Guild,
				time: DURATION,
			}) as Promise<HypixelUserMessage[]>;
			const discordChannel = chatBridge.discord.channelsByType.get(HypixelMessageType.Guild)!.channel;
			const discordMessages = discordChannel.awaitMessages({
				filter: (discordMessage) => MessageUtil.isUserMessage(discordMessage),
				time: DURATION,
			});

			// post message to both chats
			await chatBridge.broadcast(stripIndents`
				poll by ${escapeIgn(ign)}: type a number to vote (${ms(DURATION, { long: true })})
				${question}
				${pollOptions.map(({ number, option }) => `${INVISIBLE_CHARACTERS[0]}${number}: ${option}`).join('\n')}
			`);

			// aquire in-game votes
			for (const msg of await hypixelMessages) {
				const votedFor = Number.parseInt(msg.content, 10);

				// doesn't start with a number or out of range
				if (Number.isNaN(votedFor) || votedFor < 1 || votedFor > optionsCount) continue;

				pollOptions[votedFor - 1]!.votes.add(msg.player?.minecraftUuid ?? msg.author.ign);
			}

			// aquire discord votes
			for (const msg of (await discordMessages).values()) {
				const votedFor = Number.parseInt(msg.content, 10);

				// doesn't start with a number or out of range
				if (Number.isNaN(votedFor) || votedFor < 1 || votedFor > optionsCount) continue;

				pollOptions[votedFor - 1]!.votes.add(UserUtil.getPlayer(msg.author)?.minecraftUuid ?? msg.author.id);
			}

			// count votes and sort options by them
			const result = pollOptions
				.map(({ votes, ...rest }) => ({ votes: votes.size, ...rest }))
				.sort(({ votes: a }, { votes: b }) => b - a);
			const TOTAL_VOTES = result.reduce((acc, { votes }) => acc + votes, 0);
			const resultString = result.map(
				({ number, option, votes }) =>
					`#${number}: ${option} (${Math.round((votes / TOTAL_VOTES) * 100) || 0}%, ${votes} vote${
						votes === 1 ? '' : 's'
					})`,
			);

			// reply with result
			void ChannelUtil.send(discordChannel, {
				embeds: [
					this.client.defaultEmbed
						.setTitle(question)
						.setDescription(resultString.join('\n\n'))
						.setFooter({ text: `Poll by ${ign}` }), // no markdown in footer -> no need to escape IGN
				],
			});

			resultString.unshift(question);

			void chatBridge.minecraft.gchat({
				content: resultString.join('\n'),
				maxParts: Number.POSITIVE_INFINITY,
			});
		} finally {
			this.polls.delete(chatBridge); // unlock poll command
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		void InteractionUtil.deferReply(interaction, {
			ephemeral: true,
		});

		const result = await this._sharedRun({
			chatBridge: InteractionUtil.getHypixelGuild(interaction).chatBridge,
			question: interaction.options.getString('question', true),
			// @ts-expect-error
			pollOptionNames: (interaction.options._hoistedOptions as CommandInteractionOption[])
				.filter(({ name }) => name.startsWith('choice_'))
				.map(({ value }) => value as string),
			duration: interaction.options.getString('duration'),
			ign: UserUtil.getPlayer(interaction.user)?.ign ?? interaction.member?.displayName ?? interaction.user.tag,
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
	override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		// TODO: use parseArgs
		const inputMatched = /(?<=[\u0022\u201C\u201D]).+?(?=[\u0022\u201C\u201D])/u
			.exec(hypixelMessage.content)
			?.map((x) => x.trim())
			.filter(Boolean);

		if (!inputMatched || inputMatched.length < 2) return hypixelMessage.reply(this.usageInfo);

		const result = await this._sharedRun({
			chatBridge: hypixelMessage.chatBridge,
			question: upperCaseFirstChar(inputMatched.shift()!),
			pollOptionNames: inputMatched,
			duration: hypixelMessage.commandData.args.positionals[0],
			ign: hypixelMessage.author.ign,
		});

		if (result) return hypixelMessage.author.send(result);
	}
}
