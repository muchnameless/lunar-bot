import { Constants } from 'discord.js';
import { handleLeaderboardCommandInteraction } from '../../functions/leaderboards.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
// import { logger } from '../../functions/logger.js';


export default class PurgeListCommand extends SlashCommand {
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
				xpType: 'purge',
				page: interaction.options.getInteger('page') ?? 1,
				offset: interaction.options.getString('offset') ?? '',
				hypixelGuild: this.getHypixelGuild(interaction),
				user: interaction.user,
			},
		);
	}
}
