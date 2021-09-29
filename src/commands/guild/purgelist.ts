import { SlashCommandBuilder } from '@discordjs/builders';
import { pageOption, buildGuildOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { handleLeaderboardCommandInteraction } from '../../functions';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class PurgeListCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('guild members below requirements, sorted by total and gained weight')
				.addIntegerOption(pageOption)
				.addStringOption(buildGuildOption(context.client, true)),
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		return await handleLeaderboardCommandInteraction(interaction, {
			lbType: 'gained',
			xpType: 'purge',
			page: interaction.options.getInteger('page') ?? 1,
			offset: interaction.options.getString('offset') ?? '',
			hypixelGuild: InteractionUtil.getHypixelGuild(interaction, true),
			user: interaction.user,
		});
	}
}
