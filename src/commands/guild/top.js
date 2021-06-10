'use strict';

const { Constants } = require('discord.js');
const { handleLeaderboardCommandInteraction } = require('../../functions/leaderboards');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class TopCommand extends SlashCommand {
	/**
	 * @param {import('../../structures/commands/SlashCommand').CommandData} commandData
	 */
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'total leaderboard',
			options: [
				SlashCommand.XP_TYPE_OPTION,
				SlashCommand.PAGE_OPTION,
				SlashCommand.OFFSET_OPTION,
				SlashCommand.guildOptionBuilder(data.client),
				{
					name: 'purge',
					type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
					description: 'show only players below guild requirements',
					required: false,
				},
			],
			defaultPermission: true,
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		return handleLeaderboardCommandInteraction(
			interaction,
			{
				lbType: 'total',
				xpType: interaction.options.get('type')?.value ?? this.config.get('CURRENT_COMPETITION'),
				page: interaction.options.get('page')?.value ?? 1,
				offset: interaction.options.get('offset')?.value ?? '',
				hypixelGuild: this.getHypixelGuild(interaction.options, interaction),
				user: interaction.user,
				shouldShowOnlyBelowReqs: interaction.options.get('purge')?.value ?? false,
			},
		);
	}
};
