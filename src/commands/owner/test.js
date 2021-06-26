'use strict';

const { Constants } = require('discord.js');
const { logErrors: { regExp: logErrors } } = require('../../structures/chat_bridge/constants/commandResponses');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


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

		for (const player of hypixelGuild.players.values()) {
			let lastPage = await chatBridge.minecraft.command({
				command: `g log ${player} 100`,
				abortRegExp: logErrors(),
			});

			const LAST_PAGE_NUMBER = lastPage.match(/^Page must be between 1 and (\d+)[.!]?$/)?.[1];

			if (LAST_PAGE_NUMBER) {
				lastPage = await chatBridge.minecraft.command({
					command: `g log ${player} ${LAST_PAGE_NUMBER}`,
					abortRegExp: logErrors(),
				});
			}

			const matched = lastPage.match(/(?<time>.+): (?<inviter>\w{1,16}) invited \w{1,16}/);

			dates.push({
				ign: player.ign,
				joined: matched?.groups.time ?? 'unknown',
				timestamp: new Date(matched?.groups.time).getTime(),
			});
		}

		return interaction.reply({
			content: dates
				.sort((a, b) => b.timestamp - a.timestamp)
				.map(({ ign, joined }) => `${joined}: ${ign}`)
				.join('\n'),
			split: true,
		});
	}
};
