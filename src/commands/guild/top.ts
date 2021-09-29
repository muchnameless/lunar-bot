import { SlashCommandBuilder } from '@discordjs/builders';
import { xpTypeOption, pageOption, offsetOption, buildGuildOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { handleLeaderboardCommandInteraction } from '../../functions';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class TopCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('total leaderboard')
				.addStringOption(xpTypeOption)
				.addIntegerOption(pageOption)
				.addStringOption(offsetOption)
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
			lbType: 'total',
			xpType: interaction.options.getString('type') ?? this.config.get('CURRENT_COMPETITION'),
			page: interaction.options.getInteger('page') ?? 1,
			offset: interaction.options.getString('offset') ?? '',
			hypixelGuild: InteractionUtil.getHypixelGuild(interaction, true),
			user: interaction.user,
		});
	}
}
