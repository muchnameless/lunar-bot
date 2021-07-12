'use strict';

const { Constants } = require('discord.js');
const ms = require('ms');
const { logErrors: { regExp: logErrors } } = require('../../structures/chat_bridge/constants/commandResponses');
const { escapeIgn, timestampToDateMarkdown } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class JoinDateCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'guild member join date, parsed from `/g log ign`',
			options: [{
				name: 'player',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | uuid | discordID | @mention',
				required: false,
			},
			SlashCommand.FORCE_OPTION,
			SlashCommand.guildOptionBuilder(data.client) ],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	static running = false;

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
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		if (JoinDateCommand.running) return interaction.reply({
			content: 'the command is already running',
			ephemeral: true,
		});

		try {
			JoinDateCommand.running = true;

			interaction.defer();

			const hypixelGuild = this.getHypixelGuild(interaction);
			const { chatBridge } = hypixelGuild;
			const player = this.getPlayer(interaction, !(await this.client.lgGuild?.members.fetch(interaction.user.id).catch(logger.error))?.roles.cache.has(this.config.get('MANAGER_ROLE_ID')));

			let dates;

			if (player) {
				dates = [ await JoinDateCommand._getJoinDate(chatBridge, player.ign) ];
			} else {
				await interaction.awaitConfirmation(`the command will take approximately ${ms(hypixelGuild.playerCount * 2 * chatBridge.minecraft.constructor.SAFE_DELAY, { long: true })}. Confirm?`);

				dates = await Promise.all(hypixelGuild.players.map(({ ign }) => JoinDateCommand._getJoinDate(chatBridge, ign)));
			}

			return interaction.reply({
				content: dates
					.sort((a, b) => a.timestamp - b.timestamp)
					.map(({ timestamp, ign }) => `${!Number.isNaN(timestamp) ? timestampToDateMarkdown(timestamp) : 'unknown date'}: ${escapeIgn(ign)}`)
					.join('\n'),
				split: true,
			});
		} finally {
			JoinDateCommand.running = false;
		}
	}
};
