import { bold, SlashCommandBuilder, time, type ChatInputCommandInteraction } from 'discord.js';
import ms from 'ms';
import type { ChatBridge } from '#chatBridge/ChatBridge.js';
import type { HypixelUserMessage, ParseArgsConfigOptions } from '#chatBridge/HypixelMessage.js';
import { IGN_DEFAULT, logErrors } from '#chatBridge/constants/index.js';
import { MinecraftChatManager } from '#chatBridge/managers/MinecraftChatManager.js';
import { escapeIgn, seconds } from '#functions';
import { logger } from '#logger';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';
import { forceOption, hypixelGuildOption, optionalPlayerOption } from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

interface JoinInfo {
	ign: string;
	timestampSeconds: number;
}

const parseArgsOptions = {
	guild: {
		type: 'string',
		short: 'g',
	},
} as const satisfies ParseArgsConfigOptions;

export default class JoinDateCommand extends DualCommand {
	public constructor(context: CommandContext) {
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

	private readonly running = new Set<string>();

	private readonly JOINED_REGEXP = new RegExp(
		`(?<time>.+): ${IGN_DEFAULT} (?:joined|created the guild)(?:\\n.+: ${IGN_DEFAULT} invited ${IGN_DEFAULT})*$`,
	);

	/**
	 * @param chatBridge
	 * @param ign
	 */
	private async _getJoinDate(chatBridge: ChatBridge, ign: string) {
		// get first page
		let logEntry = await this._getLogEntry(chatBridge, ign, 1);
		let lastPage = Number(/\(Page 1 of (\d+)\)/.exec(logEntry)?.[1]);

		// log has more than 1 page -> get latest page
		if (lastPage !== 1) logEntry = await this._getLogEntry(chatBridge, ign, lastPage);

		let matched = this.JOINED_REGEXP.exec(logEntry);

		// last page didn't contain join, get next-to-last page
		let invitedRegExp: RegExp;
		while (!matched && lastPage >= 1) {
			matched = this.JOINED_REGEXP.exec(await this._getLogEntry(chatBridge, ign, --lastPage));

			// entry does not end with invited message -> no joined / created message at all
			if (!(invitedRegExp ??= new RegExp(`\\n.+: ${IGN_DEFAULT} invited ${ign}$`)).test(logEntry)) break;
		}

		// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
		const timestampSeconds = seconds.fromMilliseconds(Date.parse(matched?.groups!.time!));

		return {
			ign,
			timestampSeconds,
		};
	}

	/**
	 * @param chatBridge
	 * @param ign
	 * @param page
	 */
	private _getLogEntry(chatBridge: ChatBridge, ign: string, page: number) {
		return chatBridge.minecraft.command({
			command: `g log ${ign} ${page}`,
			abortRegExp: logErrors(ign),
			rejectOnAbort: true,
		});
	}

	/**
	 * execute the command
	 *
	 * @param chatBridge
	 * @param ignInput
	 */
	private async _generateReply(chatBridge: ChatBridge, ignInput: string) {
		try {
			const { ign, timestampSeconds } = await this._getJoinDate(chatBridge, ignInput);
			return `${escapeIgn(ign)}: joined ${chatBridge.hypixelGuild} at ${
				Number.isNaN(timestampSeconds) ? 'an unknown date' : time(timestampSeconds)
			}`;
		} catch {
			return `${escapeIgn(ignInput)}: never joined ${chatBridge.hypixelGuild}`;
		}
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const IGN = InteractionUtil.getIgn(interaction, {
			fallbackToCurrentUser: !(
				await hypixelGuild.discordGuild?.members
					.fetch(interaction.user)
					.catch((error) => logger.error(error, '[JOIN DATE CMD]'))
			)?.roles.cache.hasAny(...hypixelGuild.staffRoleIds),
		});

		if (!IGN) {
			// all players
			if (this.running.has(hypixelGuild.guildId)) {
				throw 'the command is already running';
			}

			const { chatBridge } = hypixelGuild;
			const joinInfos: JoinInfo[] = [];

			try {
				this.running.add(hypixelGuild.guildId);

				await InteractionUtil.awaitConfirmation(
					interaction,
					`the command will take approximately ${ms(hypixelGuild.playerCount * 2 * MinecraftChatManager.SAFE_DELAY, {
						long: true,
					})}. Confirm?`,
				);

				for (const { ign } of hypixelGuild.players.values()) {
					joinInfos.push(await this._getJoinDate(chatBridge, ign));
				}
			} finally {
				this.running.delete(hypixelGuild.guildId);
			}

			return InteractionUtil.reply(interaction, {
				content: `${bold(hypixelGuild.name)} join dates:\n${joinInfos
					.sort(({ timestampSeconds: a }, { timestampSeconds: b }) => a - b)
					.map(
						({ ign, timestampSeconds }) =>
							`${Number.isNaN(timestampSeconds) ? 'unknown date' : time(timestampSeconds)}: ${escapeIgn(ign)}`,
					)
					.join('\n')}`,
				split: true,
			});
		}

		return InteractionUtil.reply(interaction, await this._generateReply(hypixelGuild.chatBridge, IGN));
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		const {
			values: { guild: HYPIXEL_GUILD_NAME },
			positionals,
		} = hypixelMessage.commandData.parseArgs<typeof parseArgsOptions>();

		let chatBridge: ChatBridge | undefined;

		if (HYPIXEL_GUILD_NAME) {
			chatBridge = this.client.hypixelGuilds.findByName(HYPIXEL_GUILD_NAME as string)?.chatBridge;
		}

		return hypixelMessage.reply(
			await this._generateReply(chatBridge ?? hypixelMessage.chatBridge, positionals[0] ?? hypixelMessage.author.ign),
		);
	}
}
