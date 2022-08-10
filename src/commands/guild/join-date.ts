import { bold, SlashCommandBuilder, time } from 'discord.js';
import ms from 'ms';
import { logger } from '#logger';
import { InteractionUtil } from '#utils';
import { IGN_DEFAULT, logErrors } from '#chatBridge/constants';
import { forceOption, hypixelGuildOption, optionalPlayerOption } from '#structures/commands/commonOptions';
import { MinecraftChatManager } from '#chatBridge/managers/MinecraftChatManager';
import { DualCommand } from '#structures/commands/DualCommand';
import { escapeIgn } from '#functions';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { ChatBridge } from '#chatBridge/ChatBridge';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';

interface JoinInfo {
	ign: string;
	timestamp: number;
}

const parseArgsOptions = {
	guild: {
		type: 'string',
		short: 'g',
	},
} as const;

export default class JoinDateCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription('guild member join date, parsed from `/guild log IGN`')
					.addStringOption(optionalPlayerOption)
					.addBooleanOption(forceOption)
					.addStringOption(hypixelGuildOption),
				cooldown: 0,
			},
			{
				aliases: ['joined'],
				parseArgsOptions,
				usage: '<`IGN`>',
			},
		);
	}

	static running = new Set();

	static JOINED_REGEXP = new RegExp(
		`(?<time>.+): ${IGN_DEFAULT} (?:joined|created the guild)(?:\\n.+: ${IGN_DEFAULT} invited ${IGN_DEFAULT})*$`,
	);

	/**
	 * @param chatBridge
	 * @param ign
	 */
	static async getJoinDate(chatBridge: ChatBridge, ign: string) {
		// get first page
		let logEntry = await this.getLogEntry(chatBridge, ign, 1);
		let lastPage = Number(/\(Page 1 of (\d+)\)/.exec(logEntry)?.[1]);

		// log has more than 1 page -> get latest page
		if (lastPage !== 1) logEntry = await this.getLogEntry(chatBridge, ign, lastPage);

		let matched = JoinDateCommand.JOINED_REGEXP.exec(logEntry);

		// last page didn't contain join, get next-to-last page
		let invitedRegExp: RegExp;
		while (!matched && lastPage >= 1) {
			matched = JoinDateCommand.JOINED_REGEXP.exec(await this.getLogEntry(chatBridge, ign, --lastPage));

			// entry does not end with invited message -> no joined / created message at all
			if (!(invitedRegExp ??= new RegExp(`\\n.+: ${IGN_DEFAULT} invited ${ign}$`)).test(logEntry)) break;
		}

		const timestamp = Date.parse(matched?.groups!.time!);

		return {
			ign,
			timestamp,
		};
	}

	/**
	 * @param chatBridge
	 * @param ign
	 * @param page
	 */
	static getLogEntry(chatBridge: ChatBridge, ign: string, page: number) {
		return chatBridge.minecraft.command({
			command: `g log ${ign} ${page}`,
			abortRegExp: logErrors(ign),
			rejectOnAbort: true,
		});
	}

	/**
	 * execute the command
	 * @param chatBridge
	 * @param ignInput
	 */
	private async _generateReply(chatBridge: ChatBridge, ignInput: string) {
		try {
			const { ign, timestamp } = await JoinDateCommand.getJoinDate(chatBridge, ignInput);
			return `${escapeIgn(ign)}: joined ${chatBridge.hypixelGuild} at ${
				!Number.isNaN(timestamp) ? time(timestamp) : 'an unknown date'
			}`;
		} catch {
			return `${escapeIgn(ignInput)}: never joined ${chatBridge.hypixelGuild}`;
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const IGN = InteractionUtil.getIgn(interaction, {
			fallbackToCurrentUser: !(
				await hypixelGuild.discordGuild?.members.fetch(interaction.user).catch((error) => logger.error(error))
			)?.roles.cache.hasAny(...hypixelGuild.staffRoleIds),
		});

		if (!IGN) {
			// all players
			if (JoinDateCommand.running.has(hypixelGuild.guildId)) {
				throw 'the command is already running';
			}

			const { chatBridge } = hypixelGuild;
			const joinInfos: JoinInfo[] = [];

			try {
				JoinDateCommand.running.add(hypixelGuild.guildId);

				await InteractionUtil.awaitConfirmation(
					interaction,
					`the command will take approximately ${ms(hypixelGuild.playerCount * 2 * MinecraftChatManager.SAFE_DELAY, {
						long: true,
					})}. Confirm?`,
				);

				for (const { ign } of hypixelGuild.players.values()) {
					joinInfos.push(await JoinDateCommand.getJoinDate(chatBridge, ign));
				}
			} finally {
				JoinDateCommand.running.delete(hypixelGuild.guildId);
			}

			return InteractionUtil.reply(interaction, {
				content: `${bold(hypixelGuild.name)} join dates:\n${joinInfos
					.sort(({ timestamp: a }, { timestamp: b }) => a - b)
					.map(
						({ ign, timestamp }) => `${!Number.isNaN(timestamp) ? time(timestamp) : 'unknown date'}: ${escapeIgn(ign)}`,
					)
					.join('\n')}`,
				split: true,
			});
		}

		return InteractionUtil.reply(interaction, await this._generateReply(hypixelGuild.chatBridge, IGN));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async minecraftRun(hypixelMessage: HypixelUserMessage<typeof parseArgsOptions>) {
		const {
			values: { guild: HYPIXEL_GUILD_NAME },
			positionals,
		} = hypixelMessage.commandData.args;

		let chatBridge: ChatBridge | undefined;

		if (HYPIXEL_GUILD_NAME) {
			chatBridge = this.client.hypixelGuilds.findByName(HYPIXEL_GUILD_NAME as string)?.chatBridge;
		}

		return hypixelMessage.reply(
			await this._generateReply(chatBridge ?? hypixelMessage.chatBridge, positionals[0] ?? hypixelMessage.author.ign),
		);
	}
}
