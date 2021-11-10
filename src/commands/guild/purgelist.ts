import { SlashCommandBuilder } from '@discordjs/builders';
import { pageOption, buildGuildOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { handleLeaderboardCommandInteraction, seconds } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandInteraction } from 'discord.js';
import type { LeaderboardXPOffsets } from '../../functions';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class PurgeListCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('guild members below requirements, sorted by total and gained weight')
				.addIntegerOption(pageOption)
				.addStringOption(buildGuildOption(context.client, true)),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override runSlash(interaction: CommandInteraction) {
		return handleLeaderboardCommandInteraction(interaction, {
			lbType: 'gained',
			xpType: 'purge',
			page: interaction.options.getInteger('page') ?? 1,
			offset: (interaction.options.getString('offset') as LeaderboardXPOffsets) ?? '',
			hypixelGuild: InteractionUtil.getHypixelGuild(interaction, { includeAll: true }),
			user: interaction.user,
		});
	}
}
