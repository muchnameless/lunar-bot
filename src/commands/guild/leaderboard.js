import { handleLeaderboardCommandInteraction, getDefaultOffset } from '../../functions/leaderboards.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
// import { logger } from '../../functions/logger.js';


export default class LeaderboardCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [ 'lb' ],
			description: 'gained leaderboard',
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		return handleLeaderboardCommandInteraction(
			interaction,
			{
				lbType: 'gained',
				xpType: interaction.options.getString('type') ?? this.config.get('CURRENT_COMPETITION'),
				page: interaction.options.getInteger('page') ?? 1,
				offset: interaction.options.getString('offset') ?? getDefaultOffset(this.config),
				hypixelGuild: this.getHypixelGuild(interaction),
				user: interaction.user,
			},
		);
	}
}
