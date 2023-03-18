import { codeBlock, SlashCommandBuilder, type ButtonInteraction, type ChatInputCommandInteraction } from 'discord.js';
import { buildPaginationActionRow } from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { hypixelGuildOption, pageOption } from '#structures/commands/commonOptions.js';
import type { HypixelGuild } from '#structures/database/models/HypixelGuild.js';
import { InteractionUtil } from '#utils';

export default class FriendCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
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
	 *
	 * @param interaction
	 * @param hypixelGuild
	 * @param page
	 */
	private async _paginatedRun(
		interaction: ButtonInteraction<'cachedOrDM'> | ChatInputCommandInteraction<'cachedOrDM'>,
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
					.setDescription(codeBlock(response)),
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
	 *
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	public override async buttonRun(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]) {
		const [SUBCOMMAND, HYPIXEL_GUILD_ID, PAGE] = args as [string, string, string];

		switch (SUBCOMMAND) {
			case 'list':
				return this._paginatedRun(
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
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		switch (interaction.options.getSubcommand()) {
			case 'list':
				return this._paginatedRun(
					interaction,
					InteractionUtil.getHypixelGuild(interaction),
					interaction.options.getInteger('page'),
				);

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}
}
