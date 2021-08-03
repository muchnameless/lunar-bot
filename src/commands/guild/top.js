'use strict';

const { handleLeaderboardCommandInteraction } = require('../../functions/leaderboards');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class TopCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'total leaderboard',
			options: [
				SlashCommand.XP_TYPE_OPTION,
				SlashCommand.PAGE_OPTION,
				SlashCommand.OFFSET_OPTION,
				SlashCommand.guildOptionBuilder(data.client, true),
			],
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
				lbType: 'total',
				xpType: interaction.options.getString('type') ?? this.config.get('CURRENT_COMPETITION'),
				page: interaction.options.getInteger('page') ?? 1,
				offset: interaction.options.getString('offset') ?? '',
				hypixelGuild: this.getHypixelGuild(interaction),
				user: interaction.user,
			},
		);
	}
};
