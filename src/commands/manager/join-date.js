'use strict';

const { Constants } = require('discord.js');
const { logErrors: { regExp: logErrors } } = require('../../structures/chat_bridge/constants/commandResponses');
const { escapeIgn } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


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

	static JOINED_REGEXP = /(?<time>.+): \w{1,16} joined(?:\n.+: \w{1,16} invited \w{1,16})*$/;

	/**
	 * @param {import('../../structures/chat_bridge/ChatBridge')} chatBridge
	 * @param {string} ign
	 * @returns {Promise<{ ign: string, joined: string, timestamp: number }>}
	 */
	static async _getJoinDate(chatBridge, ign) {
		// get first page
		let page = await chatBridge.minecraft.command({
			command: `g log ${ign} 1`,
			abortRegExp: logErrors(),
		});

		const LAST_PAGE_NUMBER = page.match(/\(Page 1 of (\d+)\)/)?.[1];

		// log has more than 1 page -> get latest page
		if (LAST_PAGE_NUMBER !== 1) {
			page = await chatBridge.minecraft.command({
				command: `g log ${ign} ${LAST_PAGE_NUMBER}`,
				abortRegExp: logErrors(),
			});
		}

		let matched = page.match(JoinDateCommand.JOINED_REGEXP);

		// last page didn't contain join, get next-to-last page
		if (!matched) {
			page = await chatBridge.minecraft.command({
				command: `g log ${ign} ${LAST_PAGE_NUMBER - 1}`,
				abortRegExp: logErrors(),
			});

			matched = page.match(JoinDateCommand.JOINED_REGEXP);
		}

		return {
			ign,
			joined: matched?.groups.time ?? 'unknown',
			timestamp: new Date(matched?.groups.time).getTime(),
		};
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

			const hypixelGuild = this.getHypixelGuild(interaction.options, interaction);
			const { chatBridge } = hypixelGuild;
			const player = this.getPlayer(interaction.options);
			const dates = player
				? [ await JoinDateCommand._getJoinDate(chatBridge, player.ign) ]
				: await Promise.all(hypixelGuild.players.map(({ ign }) => JoinDateCommand._getJoinDate(chatBridge, ign)));

			return interaction.reply({
				content: dates
					.sort((a, b) => a.timestamp - b.timestamp)
					.map(({ ign, joined }) => `${joined}: ${escapeIgn(ign)}`)
					.join('\n'),
				split: true,
			});
		} finally {
			JoinDateCommand.running = false;
		}
	}
};
