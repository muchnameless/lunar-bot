'use strict';

const { Constants } = require('discord.js');
const { logErrors: { regExp: logErrors } } = require('../../structures/chat_bridge/constants/commandResponses');
const { escapeIgn } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class TestCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'generic test command',
			options: [{
				name: 'input',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'input',
				required: false,
			}],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		interaction.defer();

		const hypixelGuild = this.client.hypixelGuilds.mainGuild;
		const { chatBridge } = hypixelGuild;
		const dates = [];
		const joinedRegExp = /(?<time>.+): \w{1,16} joined(?:\n.+: \w{1,16} invited \w{1,16})*$/;

		for (const player of hypixelGuild.players.values()) {
			let page = await chatBridge.minecraft.command({
				command: `g log ${player} 1`,
				abortRegExp: logErrors(),
			});

			const LAST_PAGE_NUMBER = page.match(/Guild Log \(Page 1 of (\d+)\)/)?.[1];

			if (LAST_PAGE_NUMBER !== 1) {
				page = await chatBridge.minecraft.command({
					command: `g log ${player} ${LAST_PAGE_NUMBER}`,
					abortRegExp: logErrors(),
				});
			}

			let matched = page.match(joinedRegExp);

			// last page didn't contain join, search page before that
			if (!matched) {
				page = await chatBridge.minecraft.command({
					command: `g log ${player} ${LAST_PAGE_NUMBER - 1}`,
					abortRegExp: logErrors(),
				});

				matched = page.match(joinedRegExp);
			}

			dates.push({
				ign: player.ign,
				joined: matched?.groups.time ?? 'unknown',
				timestamp: new Date(matched?.groups.time).getTime(),
			});
		}

		logger.debug(dates);

		return interaction.reply({
			content: dates
				.sort((a, b) => a.timestamp - b.timestamp)
				.map(({ ign, joined }) => `${joined}: ${escapeIgn(ign)}`)
				.join('\n'),
			split: true,
		});
	}
};
