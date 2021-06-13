'use strict';

const { Constants } = require('discord.js');
const { handleLeaderboardCommandInteraction } = require('../../functions/leaderboards');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class TopCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'guild members below requirements, sorted by total and gained weight',
			options: [{
				name: 'page',
				type: Constants.ApplicationCommandOptionTypes.INTEGER,
				description: 'page number',
				required: false,
			},
			SlashCommand.guildOptionBuilder(data.client),
			],
			defaultPermission: true,
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		return handleLeaderboardCommandInteraction(
			interaction,
			{
				lbType: 'gained',
				xpType: 'purge',
				page: interaction.options.get('page')?.value ?? 1,
				offset: interaction.options.get('offset')?.value ?? '',
				hypixelGuild: this.getHypixelGuild(interaction.options, interaction),
				user: interaction.user,
				shouldShowOnlyBelowReqs: true,
			},
		);
	}
};
