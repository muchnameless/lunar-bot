import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, Formatters } from 'discord.js';
import ms from 'ms';
import { logErrors } from '../../structures/chat_bridge/constants';
import { forceOption, optionalPlayerOption, buildGuildOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { escapeIgn, logger } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { Snowflake } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { ChatBridge } from '../../structures/chat_bridge/ChatBridge';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';


interface JoinInfo {
	ign: string;
	date: Date;
	timestamp: number;
}


export default class JoinDateCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('guild member join date, parsed from `/g log ign`')
				.addStringOption(optionalPlayerOption)
				.addBooleanOption(forceOption)
				.addStringOption(buildGuildOption(context.client)),
			cooldown: 0,
		}, {
			aliases: [ 'joined' ],
			args: false,
			usage: '<`IGN`>',
		});
	}

	static running = new Set();

	static JOINED_REGEXP = /(?<time>.+): \w{1,16} (?:joined|created the guild)(?:\n.+: \w{1,16} invited \w{1,16})*$/;

	/**
	 * @param chatBridge
	 * @param ign
	 */
	static async #getJoinDate(chatBridge: ChatBridge, ign: string) {
		// get first page
		let logEntry = await this.#getLogEntry(chatBridge, ign, 1);
		let lastPage = Number(logEntry.match(/\(Page 1 of (\d+)\)/)?.[1]);

		// log has more than 1 page -> get latest page
		if (lastPage !== 1) logEntry = await this.#getLogEntry(chatBridge, ign, lastPage);

		let matched = logEntry.match(JoinDateCommand.JOINED_REGEXP);

		// last page didn't contain join, get next-to-last page
		while (!matched && lastPage >= 1) {
			matched = (await this.#getLogEntry(chatBridge, ign, --lastPage)).match(JoinDateCommand.JOINED_REGEXP);

			// entry does not end with invited message -> no joined / created message at all
			if (!new RegExp(`\\n.+: \\w{1,16} invited ${ign}$`).test(logEntry)) break;
		}

		const date = new Date(matched?.groups.time);

		return {
			ign,
			date,
			timestamp: date.getTime(),
		};
	}

	/**
	 * @param chatBridge
	 * @param ign
	 * @param page
	 */
	static #getLogEntry(chatBridge: ChatBridge, ign: string, page: number) {
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
	// eslint-disable-next-line class-methods-use-this
	async #generateReply(chatBridge: ChatBridge, ignInput: string) {
		try {
			const { ign, date, timestamp } = await JoinDateCommand.#getJoinDate(chatBridge, ignInput);
			return `${ign}: joined at ${!Number.isNaN(timestamp) ? Formatters.time(date) : 'an unknown date'}`;
		} catch {
			return `${ignInput}: never joined ${chatBridge.hypixelGuild!.name}`;
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const player = InteractionUtil.getPlayer(
			interaction,
			{ fallbackToCurrentUser:
				!(await this.client.lgGuild?.members.fetch(interaction.user).catch(logger.error))?.roles.cache.has(this.config.get('MANAGER_ROLE_ID')),
			},
		);
		const hypixelGuild = player?.hypixelGuild ?? InteractionUtil.getHypixelGuild(interaction);

		if (!player) {
			// all players
			if (JoinDateCommand.running.has(hypixelGuild.guildId)) return await InteractionUtil.reply(interaction, {
				content: 'the command is already running',
				ephemeral: true,
			});

			const { chatBridge } = hypixelGuild;
			const joinInfos: JoinInfo[] = [];

			try {
				JoinDateCommand.running.add(hypixelGuild.guildId);

				await InteractionUtil.awaitConfirmation(interaction, `the command will take approximately ${ms(hypixelGuild.playerCount * 2 * chatBridge.minecraft.constructor.SAFE_DELAY, { long: true })}. Confirm?`);

				for (const { ign } of hypixelGuild.players.values()) {
					joinInfos.push(await JoinDateCommand.#getJoinDate(chatBridge, ign));
				}
			} finally {
				JoinDateCommand.running.delete(hypixelGuild.guildId);
			}

			return await InteractionUtil.reply(interaction, {
				content: `${Formatters.bold(hypixelGuild.name)} join dates:\n${joinInfos
					.sort((a, b) => a.timestamp - b.timestamp)
					.map(({ ign, date, timestamp }) => `${!Number.isNaN(timestamp) ? Formatters.time(date) : 'unknown date'}: ${escapeIgn(ign)}`)
					.join('\n')}`,
				split: true,
			});
		}

		return await InteractionUtil.reply(interaction, await this.#generateReply(hypixelGuild.chatBridge, player.ign));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelMessage<true>) {
		return await hypixelMessage.reply(await this.#generateReply(
			hypixelMessage.chatBridge,
			hypixelMessage.commandData.args[0] ?? hypixelMessage.author.ign,
		));
	}
}
