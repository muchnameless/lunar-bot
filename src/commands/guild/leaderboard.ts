import { SlashCommandBuilder } from 'discord.js';
import { InteractionUtil } from '#utils';
import { hypixelGuildOption, offsetOption, pageOption, xpTypeOption } from '#structures/commands/commonOptions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import { getDefaultOffset, handleLeaderboardCommandInteraction, seconds } from '#functions';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { LeaderboardXPOffsets, LeaderboardXPTypes } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class LeaderboardCommand extends ApplicationCommand {
	includeAllHypixelGuilds = true;

	constructor(context: CommandContext) {
		super(context, {
			aliases: ['lb'],
			slash: new SlashCommandBuilder()
				.setDescription('gained leaderboard')
				.addStringOption(xpTypeOption)
				.addIntegerOption(pageOption)
				.addStringOption(offsetOption)
				.addStringOption(hypixelGuildOption),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return handleLeaderboardCommandInteraction(interaction, {
			lbType: 'gained',
			xpType: (interaction.options.getString('type') as LeaderboardXPTypes) ?? this.config.get('CURRENT_COMPETITION'),
			page: interaction.options.getInteger('page') ?? 1,
			offset: (interaction.options.getString('offset') as LeaderboardXPOffsets) ?? getDefaultOffset(this.config),
			hypixelGuild: InteractionUtil.getHypixelGuild(interaction, { includeAll: true }),
			user: interaction.user,
		});
	}
}
