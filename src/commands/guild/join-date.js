'use strict';

const { Constants } = require('discord.js');
const ms = require('ms');
const { logErrors: { regExp: logErrors } } = require('../../structures/chat_bridge/constants/commandResponses');
const { escapeIgn, timestampToDateMarkdown } = require('../../functions/util');
const DualCommand = require('../../structures/commands/DualCommand');
const logger = require('../../functions/logger');


module.exports = class JoinDateCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'guild member join date, parsed from `/g log ign`',
				options: [
					{
						name: 'player',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'IGN | uuid | discordID | @mention',
						required: false,
					},
					DualCommand.FORCE_OPTION,
					DualCommand.guildOptionBuilder(data.client),
				],
				defaultPermission: true,
				cooldown: 0,
			},
			{
				aliases: [ 'joined' ],
				args: false,
				usage: '<`IGN`>',
			},
		);
	}

	static running = new Set();

	static JOINED_REGEXP = /(?<time>.+): \w{1,16} (?:joined|created the guild)(?:\n.+: \w{1,16} invited \w{1,16})*$/;

	/**
	 * @param {import('../../structures/chat_bridge/ChatBridge')} chatBridge
	 * @param {string} ign
	 */
	static async _getJoinDate(chatBridge, ign) {
		// get first page
		let logEntry = await this._getLogEntry(chatBridge, ign, 1);
		let lastPage = logEntry.match(/\(Page 1 of (\d+)\)/)?.[1];

		// log has more than 1 page -> get latest page
		if (lastPage !== 1) logEntry = await this._getLogEntry(chatBridge, ign, lastPage);

		let matched = logEntry.match(JoinDateCommand.JOINED_REGEXP);

		// last page didn't contain join, get next-to-last page
		while (!matched && lastPage >= 1) {
			matched = (await this._getLogEntry(chatBridge, ign, --lastPage)).match(JoinDateCommand.JOINED_REGEXP);

			// entry does not end with invited message -> no joined / created message at all
			if (!new RegExp(`\\n.+: \\w{1,16} invited ${ign}$`).test(logEntry)) break;
		}

		return {
			ign,
			timestamp: Date.parse(matched?.groups.time),
		};
	}

	/**
	 * @param {import('../../structures/chat_bridge/ChatBridge')} chatBridge
	 * @param {string} ign
	 * @param {number} page
	 */
	static _getLogEntry(chatBridge, ign, page) {
		return chatBridge.minecraft.command({
			command: `g log ${ign} ${page}`,
			abortRegExp: logErrors(),
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {import('../../structures/chat_bridge/ChatBridge')} chatBridge
	 * @param {import('../../structures/database/models/Player')} ign
	 */
	async _run(ctx, chatBridge, ign) { // eslint-disable-line no-unused-vars
		if (ign) { // single player
			const { timestamp } = await JoinDateCommand._getJoinDate(chatBridge, ign);

			return ctx.reply(`${ign}: joined at ${!Number.isNaN(timestamp) ? timestampToDateMarkdown(timestamp) : 'an unknown date'}`);
		}

		// all players
		if (JoinDateCommand.running.has(chatBridge.guild.guildId)) return ctx.reply({
			content: 'the command is already running',
			ephemeral: true,
		});

		await ctx.awaitConfirmation(`the command will take approximately ${ms(chatBridge.guild.playerCount * 2 * chatBridge.minecraft.constructor.SAFE_DELAY, { long: true })}. Confirm?`);

		let dates;

		try {
			JoinDateCommand.running.add(chatBridge.guild.guildId);
			dates = await Promise.all(chatBridge.guild.players.map(({ ign: playerIgn }) => JoinDateCommand._getJoinDate(chatBridge, playerIgn)));
		} finally {
			JoinDateCommand.running.delete(chatBridge.guild.guildId);
		}

		return ctx.reply({
			content: dates
				.sort((a, b) => a.timestamp - b.timestamp)
				.map(({ timestamp, ign: playerIgn }) => `${!Number.isNaN(timestamp) ? timestampToDateMarkdown(timestamp) : 'unknown date'}: ${escapeIgn(playerIgn)}`)
				.join('\n'),
			split: true,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		interaction.defer();

		return this._run(
			interaction,
			this.getHypixelGuild(interaction).chatBridge,
			this.getIgn(interaction, !(await this.client.lgGuild?.members.fetch(interaction.user.id).catch(logger.error))?.roles.cache.has(this.config.get('MANAGER_ROLE_ID'))),
		);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		return this._run(
			message,
			message.chatBridge,
			args[0] ?? message.author.ign,
		);
	}
};
