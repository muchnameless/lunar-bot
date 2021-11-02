import { SlashCommandBuilder } from '@discordjs/builders';
import { Constants, Formatters, MessageActionRow, MessageButton } from 'discord.js';
import { pageOption, requiredIgnOption } from '../../structures/commands/commonOptions';
import { mojang } from '../../api';
import { escapeIgn, logger } from '../../functions';
import { InteractionUtil } from '../../util';
import { DOUBLE_LEFT_EMOJI, LEFT_EMOJI, RIGHT_EMOJI, DOUBLE_RIGHT_EMOJI, RELOAD_EMOJI } from '../../constants';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { ButtonInteraction, CommandInteraction } from 'discord.js';


export default class BanListCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('ban list')
				.addSubcommand(subcommand => subcommand
					.setName('add')
					.setDescription('add a player to the ban list')
					.addStringOption(requiredIgnOption)
					.addStringOption(option => option
						.setName('reason')
						.setDescription('ban reason'),
					),
				)
				.addSubcommand(subcommand => subcommand
					.setName('remove')
					.setDescription('remove a player from the ban list')
					.addStringOption(requiredIgnOption),
				)
				.addSubcommand(subcommand => subcommand
					.setName('check')
					.setDescription('check if a player is on the ban list')
					.addStringOption(requiredIgnOption),
				)
				.addSubcommand(subcommand => subcommand
					.setName('view')
					.setDescription('shows the ban list')
					.addIntegerOption(pageOption),
				),
			cooldown: 0,
		});
	}

	/**
	 * @param currentPage
	 * @param totalPages
	 */
	#getPaginationButtons(currentPage: number, totalPages: number) {
		const CUSTOM_ID = `${this.baseCustomId}:view`;
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
	async #runView(interaction: CommandInteraction | ButtonInteraction, page: number) {
		const ELEMENTS_PER_PAGE = this.config.get('ELEMENTS_PER_PAGE');
		const OFFSET = (page - 1) * ELEMENTS_PER_PAGE;
		const { rows: bans, count } = await this.client.db.models.HypixelGuildBan.findAndCountAll({
			offset: OFFSET,
			limit: ELEMENTS_PER_PAGE,
		});
		const TOTAL_PAGES = Math.max(Math.ceil(count / ELEMENTS_PER_PAGE), 1);
		const withIgn = await Promise.all(bans
			.map(async ({ minecraftUuid, reason }) => {
				try {
					const { ign } = await mojang.uuid(minecraftUuid);
					return `${ign}: ${reason}`;
				} catch (error) {
					logger.error(error);
					return `${minecraftUuid}: ${reason}`;
				}
			}),
		);

		return (InteractionUtil[interaction.isApplicationCommand() ? 'reply' : 'update'] as typeof InteractionUtil['reply'])(interaction as ButtonInteraction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`Ban list (${count} players)`)
					.setDescription(Formatters.codeBlock(withIgn.join('\n\n')))
					.setFooter(`Page: ${page} / ${TOTAL_PAGES}`),
			],
			components: this.#getPaginationButtons(
				count >= OFFSET
					? page
					: TOTAL_PAGES, // reset to total pages in case of page overflow
				TOTAL_PAGES,
			),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	override runButton(interaction: ButtonInteraction, args: string[]) {
		const [ SUBCOMMAND, PAGE ] = args;

		switch (SUBCOMMAND) {
			case 'view':
				return this.#runView(
					interaction,
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
	override async runSlash(interaction: CommandInteraction) {
		switch (interaction.options.getSubcommand()) {
			case 'add': {
				const { ign, uuid } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
				const existingBan = await this.client.db.models.HypixelGuildBan.findByPk(uuid);
				const REASON = interaction.options.getString('reason');

				if (existingBan && !REASON) {
					return InteractionUtil.reply(interaction, {
						content: `${escapeIgn(ign)} is already on the ban list for \`${existingBan.reason}\``,
					});
				}

				await this.client.db.models.HypixelGuildBan.upsert({
					minecraftUuid: uuid,
					_reason: REASON,
				});

				if (!existingBan) return InteractionUtil.reply(interaction, {
					content: `${escapeIgn(ign)} was added to the ban list for \`${REASON ?? 'no reason'}\``,
				});

				return InteractionUtil.reply(interaction, {
					content: `${escapeIgn(ign)}'s ban reason was updated from \`${existingBan.reason}\` to \`${REASON}\``,
				});
			}

			case 'remove': {
				const { ign, uuid } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
				const existingBan = await this.client.db.models.HypixelGuildBan.findByPk(uuid);

				if (!existingBan) return InteractionUtil.reply(interaction, {
					content: `${escapeIgn(ign)} is not on the ban list`,
				});

				await existingBan.destroy();

				return InteractionUtil.reply(interaction, {
					content: `${escapeIgn(ign)}'s ban with reason \`${existingBan.reason}\` has been removed`,
				});
			}

			case 'check': {
				const { ign, uuid } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
				const existingBan = await this.client.db.models.HypixelGuildBan.findByPk(uuid);

				if (!existingBan) return InteractionUtil.reply(interaction, {
					content: `${escapeIgn(ign)} is not on the ban list`,
				});

				return InteractionUtil.reply(interaction, {
					content: `${escapeIgn(ign)} is on the ban list for \`${existingBan.reason}\``,
				});
			}

			case 'view':
				return this.#runView(
					interaction,
					interaction.options.getInteger('page') ?? 1,
				);

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}
}
