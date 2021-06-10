'use strict';

const { Constants } = require('discord.js');
const { offsetFlags } = require('../../constants/database');
const { handleLeaderboardCommandInteraction } = require('../../functions/leaderboards');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class LeaderboardCommand extends SlashCommand {
	/**
	 * @param {import('../../structures/commands/SlashCommand').CommandData} commandData
	 */
	constructor(data) {
		super(data, {
			aliases: [ 'lb' ],
			description: 'gained leaderboard',
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
				lbType: 'gained',
				xpType: interaction.options.get('type')?.value ?? this.config.get('CURRENT_COMPETITION'),
				page: interaction.options.get('page')?.value ?? 1,
				offset: interaction.options.get('offset')?.value
					?? (this.config.getBoolean('COMPETITION_RUNNING') || (Date.now() - this.config.getNumber('COMPETITION_END_TIME') >= 0 && Date.now() - this.config.getNumber('COMPETITION_END_TIME') <= 24 * 60 * 60 * 1_000)
						? offsetFlags.COMPETITION_START
						: this.config.get('DEFAULT_XP_OFFSET')),
				hypixelGuild: this.getHypixelGuild(interaction.options, interaction),
				user: interaction.user,
				shouldShowOnlyBelowReqs: interaction.options.get('purge')?.value ?? false,
			},
		);
	}
};
