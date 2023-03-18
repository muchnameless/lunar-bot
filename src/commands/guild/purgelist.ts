import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { handleLeaderboardCommandInteraction, seconds, type LeaderboardXPOffsets } from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { hypixelGuildOption, pageOption } from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

export default class PurgeListCommand extends ApplicationCommand {
	public readonly includeAllHypixelGuilds = true;

	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('guild members below requirements, sorted by total and gained weight')
				.addIntegerOption(pageOption)
				.addStringOption(hypixelGuildOption),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
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
