import { SlashCommandBuilder } from '@discordjs/builders';
import { handleLeaderboardCommandInteraction, getDefaultOffset } from '../../functions/leaderboards.js';
import { xpTypeOption, pageOption, offsetOption, buildGuildOption } from '../../structures/commands/commonOptions.js';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
// import { logger } from '../../functions/logger.js';


export default class LeaderboardCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [ 'lb' ],
			slash: new SlashCommandBuilder()
				.setDescription('gained leaderboard')
				.addStringOption(xpTypeOption)
				.addIntegerOption(pageOption)
				.addStringOption(offsetOption)
				.addStringOption(buildGuildOption(context.client, true)),
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		return await handleLeaderboardCommandInteraction(interaction, {
			lbType: 'gained',
			xpType: interaction.options.getString('type') ?? this.config.get('CURRENT_COMPETITION'),
			page: interaction.options.getInteger('page') ?? 1,
			offset: interaction.options.getString('offset') ?? getDefaultOffset(this.config),
			hypixelGuild: InteractionUtil.getHypixelGuild(interaction),
			user: interaction.user,
		});
	}
}
