import { SlashCommandBuilder } from '@discordjs/builders';
import { xpTypeOption, pageOption, offsetOption, buildGuildOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { handleLeaderboardCommandInteraction, seconds } from '../../functions';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { CommandInteraction } from 'discord.js';
import type { LeaderboardXPOffsets, LeaderboardXPTypes } from '../../functions';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class TopCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('total leaderboard')
				.addStringOption(xpTypeOption)
				.addIntegerOption(pageOption)
				.addStringOption(offsetOption)
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
			lbType: 'total',
			xpType: interaction.options.getString('type') as LeaderboardXPTypes ?? this.config.get('CURRENT_COMPETITION'),
			page: interaction.options.getInteger('page') ?? 1,
			offset: interaction.options.getString('offset') as LeaderboardXPOffsets ?? '',
			hypixelGuild: InteractionUtil.getHypixelGuild(interaction, { includeAll: true }),
			user: interaction.user,
		});
	}
}
