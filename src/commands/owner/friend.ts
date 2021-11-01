import { Constants, Formatters, MessageActionRow, MessageButton } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { buildGuildOption, pageOption } from '../../structures/commands/commonOptions';
import { DOUBLE_LEFT_EMOJI, LEFT_EMOJI, RIGHT_EMOJI, DOUBLE_RIGHT_EMOJI, RELOAD_EMOJI } from '../../constants';
import { InteractionUtil } from '../../util';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { ButtonInteraction, CommandInteraction } from 'discord.js';
import type { HypixelGuild } from '../../structures/database/models/HypixelGuild';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class FriendCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('Hypixel friend commands for the Chat Bridge bot')
				.addSubcommand(subcommand => subcommand
					.setName('list')
					.setDescription('list friends')
					.addStringOption(buildGuildOption(context.client))
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
	#getPaginationButtons(hypixelGuildId: string, currentPage: number, totalPages: number) {
		const CUSTOM_ID = `${this.baseCustomId}:list:${hypixelGuildId}`;
		const INVALID_PAGES = Number.isNaN(currentPage) || Number.isNaN(totalPages);
		const DEC_DISABLED = currentPage === 1 || INVALID_PAGES;
		const INC_DISABLED = currentPage === totalPages || INVALID_PAGES;

		return [
			new MessageActionRow()
				.addComponents(
					new MessageButton()
						.setCustomId(`${CUSTOM_ID}:1:${DOUBLE_LEFT_EMOJI}`)
						.setEmoji(DOUBLE_LEFT_EMOJI)
						.setStyle(Constants.MessageButtonStyles.PRIMARY)
						.setDisabled(DEC_DISABLED),
					new MessageButton()
						.setCustomId(`${CUSTOM_ID}:${currentPage - 1}:${LEFT_EMOJI}`)
						.setEmoji(LEFT_EMOJI)
						.setStyle(Constants.MessageButtonStyles.PRIMARY)
						.setDisabled(DEC_DISABLED),
					new MessageButton()
						.setCustomId(`${CUSTOM_ID}:${currentPage + 1}:${RIGHT_EMOJI}`)
						.setEmoji(RIGHT_EMOJI)
						.setStyle(Constants.MessageButtonStyles.PRIMARY)
						.setDisabled(INC_DISABLED),
					new MessageButton()
						.setCustomId(`${CUSTOM_ID}:${totalPages}:${DOUBLE_RIGHT_EMOJI}`)
						.setEmoji(DOUBLE_RIGHT_EMOJI)
						.setStyle(Constants.MessageButtonStyles.PRIMARY)
						.setDisabled(INC_DISABLED),
					new MessageButton()
						.setCustomId(`${CUSTOM_ID}:${currentPage}:${RELOAD_EMOJI}`)
						.setEmoji(RELOAD_EMOJI)
						.setStyle(Constants.MessageButtonStyles.PRIMARY),
				),
		];
	}

	/**
	 * /friend list [page]
	 * @param interaction
	 * @param hypixelGuild
	 * @param page
	 */
	async #runPaginated(interaction: CommandInteraction | ButtonInteraction, hypixelGuild: HypixelGuild, page: number | null) {
		const command = `friend list ${page ?? ''}`;
		const response = await hypixelGuild.chatBridge.minecraft.command({ command });
		const pageMatched = response.match(/\(Page (?<current>\d+) of (?<total>\d+)\)/);

		return (InteractionUtil[interaction.isApplicationCommand() ? 'reply' : 'update'] as typeof InteractionUtil['reply'])(interaction as ButtonInteraction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${command}`)
					.setDescription(Formatters.codeBlock(response)),
			],
			components: this.#getPaginationButtons(
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
		const [ SUBCOMMAND, HYPIXEL_GUILD_ID, PAGE ] = args;

		switch (SUBCOMMAND) {
			case 'list':
				return this.#runPaginated(
					interaction,
					this.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID) ?? (() => { throw new Error('uncached hypixel guild'); })(),
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
	override runSlash(interaction: CommandInteraction) {
		switch (interaction.options.getSubcommand()) {
			case 'list':
				return this.#runPaginated(
					interaction,
					InteractionUtil.getHypixelGuild(interaction),
					interaction.options.getInteger('page'),
				);

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}
}
