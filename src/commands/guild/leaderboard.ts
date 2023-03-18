import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import {
	getDefaultOffset,
	handleLeaderboardCommandInteraction,
	seconds,
	type LeaderboardXPOffsets,
	type LeaderboardXPTypes,
} from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { hypixelGuildOption, offsetOption, pageOption, xpTypeOption } from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

export default class LeaderboardCommand extends ApplicationCommand {
	public readonly includeAllHypixelGuilds = true;

	public constructor(context: CommandContext) {
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
	 *
	 * @param interaction
	 */
	public override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
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
