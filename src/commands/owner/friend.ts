import { Formatters } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { hypixelGuildOption, pageOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import { buildPaginationActionRow } from '../../functions';
import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import type { HypixelGuild } from '../../structures/database/models/HypixelGuild';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class FriendCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('Hypixel friend commands for the Chat Bridge bot')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('list')
						.setDescription('list friends')
						.addStringOption(hypixelGuildOption)
						.addIntegerOption(pageOption),
				),
			cooldown: 0,
		});
	}

	/**
	 * /friend list [page]
	 * @param interaction
	 * @param hypixelGuild
	 * @param page
	 */
	private async _runPaginated(
		interaction: ChatInputCommandInteraction | ButtonInteraction,
		hypixelGuild: HypixelGuild,
		page: number | null,
	) {
		const command = `friend list ${page ?? ''}`;
		const response = await hypixelGuild.chatBridge.minecraft.command({ command });
		const pageMatched = response.match(/\(Page (?<current>\d+) of (?<total>\d+)\)/);

		return InteractionUtil.replyOrUpdate(interaction, {
			embeds: [
				this.client.defaultEmbed //
					.setTitle(`/${command}`)
					.setDescription(Formatters.codeBlock(response)),
			],
			components: [
				buildPaginationActionRow(
					`${this.baseCustomId}:list:${hypixelGuild.guildId}`,
					Number(pageMatched?.groups!.current),
					Number(pageMatched?.groups!.total),
				),
			],
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	override runButton(interaction: ButtonInteraction, args: string[]) {
		const [SUBCOMMAND, HYPIXEL_GUILD_ID, PAGE] = args;

		switch (SUBCOMMAND) {
			case 'list':
				return this._runPaginated(
					interaction,
					this.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID) ??
						(() => {
							throw new Error('uncached hypixel guild');
						})(),
					Number(PAGE),
				);

			default:
				throw new Error(`unknown subcommand '${SUBCOMMAND}'`);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override runSlash(interaction: ChatInputCommandInteraction) {
		switch (interaction.options.getSubcommand()) {
			case 'list':
				return this._runPaginated(
					interaction,
					InteractionUtil.getHypixelGuild(interaction),
					interaction.options.getInteger('page'),
				);

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}
}
