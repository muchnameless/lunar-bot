import { ActionRow, ButtonComponent, ButtonStyle, Formatters } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { hypixelGuildOption, pageOption } from '../../structures/commands/commonOptions';
import { DOUBLE_LEFT_EMOJI, LEFT_EMOJI, RIGHT_EMOJI, DOUBLE_RIGHT_EMOJI, RELOAD_EMOJI } from '../../constants';
import { InteractionUtil } from '../../util';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
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
	 * @param hypixelGuildId
	 * @param currentPage
	 * @param totalPages
	 */
	private _getPaginationButtons(hypixelGuildId: string, currentPage: number, totalPages: number) {
		const CUSTOM_ID = `${this.baseCustomId}:list:${hypixelGuildId}`;
		const INVALID_PAGES = Number.isNaN(currentPage) || Number.isNaN(totalPages);
		const DEC_DISABLED = currentPage === 1 || INVALID_PAGES;
		const INC_DISABLED = currentPage === totalPages || INVALID_PAGES;

		return [
			new ActionRow().addComponents(
				new ButtonComponent()
					.setCustomId(`${CUSTOM_ID}:1:${DOUBLE_LEFT_EMOJI}`)
					.setEmoji({ name: DOUBLE_LEFT_EMOJI })
					.setStyle(ButtonStyle.Primary)
					.setDisabled(DEC_DISABLED),
				new ButtonComponent()
					.setCustomId(`${CUSTOM_ID}:${currentPage - 1}:${LEFT_EMOJI}`)
					.setEmoji({ name: LEFT_EMOJI })
					.setStyle(ButtonStyle.Primary)
					.setDisabled(DEC_DISABLED),
				new ButtonComponent()
					.setCustomId(`${CUSTOM_ID}:${currentPage + 1}:${RIGHT_EMOJI}`)
					.setEmoji({ name: RIGHT_EMOJI })
					.setStyle(ButtonStyle.Primary)
					.setDisabled(INC_DISABLED),
				new ButtonComponent()
					.setCustomId(`${CUSTOM_ID}:${totalPages}:${DOUBLE_RIGHT_EMOJI}`)
					.setEmoji({ name: DOUBLE_RIGHT_EMOJI })
					.setStyle(ButtonStyle.Primary)
					.setDisabled(INC_DISABLED),
				new ButtonComponent()
					.setCustomId(`${CUSTOM_ID}:${currentPage}:${RELOAD_EMOJI}`)
					.setEmoji({ name: RELOAD_EMOJI })
					.setStyle(ButtonStyle.Primary),
			),
		];
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
			components: this._getPaginationButtons(
				hypixelGuild.guildId,
				Number(pageMatched?.groups!.current),
				Number(pageMatched?.groups!.total),
			),
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
