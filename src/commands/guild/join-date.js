import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import ms from 'ms';
import { logErrors } from '../../structures/chat_bridge/constants/commandResponses.js';
import { escapeIgn } from '../../functions/util.js';
import { forceOption, optionalPlayerOption, buildGuildOption } from '../../structures/commands/commonOptions.js';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
import { logger } from '../../functions/logger.js';


/**
 * @typedef {object} JoinInfo
 * @property {string} ign
 * @property {Date} date
 * @property {number} timestamp
 */

export default class JoinDateCommand extends DualCommand {
	constructor(context) {
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
	 * @param {import('../../structures/chat_bridge/ChatBridge').ChatBridge} chatBridge
	 * @param {string} ign
	 * @returns {Promise<JoinInfo>}
	 */
	static async #getJoinDate(chatBridge, ign) {
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
	 * @param {import('../../structures/chat_bridge/ChatBridge').ChatBridge} chatBridge
	 * @param {string} ign
	 * @param {number} page
	 */
	static #getLogEntry(chatBridge, ign, page) {
		return chatBridge.minecraft.command({
			command: `g log ${ign} ${page}`,
			abortRegExp: logErrors(ign),
			rejectOnAbort: true,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/ChatBridge').ChatBridge} chatBridge
	 * @param {import('../../structures/database/models/Player').Player} ignInput
	 */
	// eslint-disable-next-line class-methods-use-this
	async #generateReply(chatBridge, ignInput) {
		try {
			const { ign, date, timestamp } = await JoinDateCommand.#getJoinDate(chatBridge, ignInput);
			return `${ign}: joined at ${!Number.isNaN(timestamp) ? Formatters.time(date) : 'an unknown date'}`;
		} catch {
			return `${ignInput}: never joined ${chatBridge.hypixelGuild.name}`;
		}
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		InteractionUtil.deferReply(interaction);

		const { chatBridge } = InteractionUtil.getHypixelGuild(interaction);
		const IGN = InteractionUtil.getIgn(interaction, !(await this.client.lgGuild?.members.fetch(interaction.user).catch(logger.error))?.roles.cache.has(this.config.get('MANAGER_ROLE_ID')));

		if (!IGN) {
			// all players
			if (JoinDateCommand.running.has(chatBridge.hypixelGuild.guildId)) return await InteractionUtil.reply(interaction, {
				content: 'the command is already running',
				ephemeral: true,
			});

			const joinInfos = [];

			try {
				JoinDateCommand.running.add(chatBridge.hypixelGuild.guildId);

				await InteractionUtil.awaitConfirmation(interaction, `the command will take approximately ${ms(chatBridge.hypixelGuild.playerCount * 2 * chatBridge.minecraft.constructor.SAFE_DELAY, { long: true })}. Confirm?`);

				for (const { ign } of chatBridge.hypixelGuild.players.values()) {
					joinInfos.push(await JoinDateCommand.#getJoinDate(chatBridge, ign));
				}
			} finally {
				JoinDateCommand.running.delete(chatBridge.hypixelGuild.guildId);
			}

			return await InteractionUtil.reply(interaction, {
				content: `${Formatters.bold(chatBridge.hypixelGuild.name)} join dates:\n${joinInfos
					.sort((a, b) => a.timestamp - b.timestamp)
					.map(({ ign, date, timestamp }) => `${!Number.isNaN(timestamp) ? Formatters.time(date) : 'unknown date'}: ${escapeIgn(ign)}`)
					.join('\n')}`,
				split: true,
			});
		}

		return await InteractionUtil.reply(interaction, await this.#generateReply(chatBridge, IGN));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		return await hypixelMessage.reply(await this.#generateReply(
			hypixelMessage.chatBridge,
			hypixelMessage.commandData.args[0] ?? hypixelMessage.author.ign,
		));
	}
}
