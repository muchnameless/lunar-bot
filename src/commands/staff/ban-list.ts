import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRow, ButtonComponent, ButtonStyle, Embed, Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import { pageOption, requiredIgnOption } from '../../structures/commands/commonOptions';
import { mojang } from '../../api';
import { escapeIgn, logger } from '../../functions';
import { InteractionUtil } from '../../util';
import {
	DOUBLE_LEFT_EMOJI,
	LEFT_EMOJI,
	RIGHT_EMOJI,
	DOUBLE_RIGHT_EMOJI,
	RELOAD_EMOJI,
	STATS_URL_BASE,
} from '../../constants';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { ButtonInteraction, ChatInputCommandInteraction, Snowflake } from 'discord.js';

export default class BanListCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('ban list')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('add')
						.setDescription('add a player to the ban list')
						.addStringOption(requiredIgnOption)
						.addStringOption((option) =>
							option //
								.setName('reason')
								.setDescription('ban reason'),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('remove')
						.setDescription('remove a player from the ban list')
						.addStringOption(requiredIgnOption),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('check')
						.setDescription('check if a player is on the ban list')
						.addStringOption(requiredIgnOption),
				)
				.addSubcommand((subcommand) =>
					subcommand //
						.setName('view')
						.setDescription('shows the ban list')
						.addIntegerOption(pageOption),
				),
			cooldown: 0,
		});
	}

	/**
	 * @param userId
	 * @param currentPage
	 * @param totalPages
	 */
	private _getPaginationButtons(userId: Snowflake, currentPage: number, totalPages: number) {
		const CUSTOM_ID = `${this.baseCustomId}:view:${userId}`;
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
	 * @param userId
	 * @param page
	 */
	private async _runView(
		interaction: ChatInputCommandInteraction | ButtonInteraction,
		userId: Snowflake,
		page: number,
	) {
		const ELEMENTS_PER_PAGE = this.config.get('ELEMENTS_PER_PAGE');
		const OFFSET = (page - 1) * ELEMENTS_PER_PAGE;
		const { rows: bans, count } = await this.client.db.models.HypixelGuildBan.findAndCountAll({
			order: [['updatedAt', 'DESC']], // newest entries first
			offset: OFFSET,
			limit: ELEMENTS_PER_PAGE,
		});
		const TOTAL_PAGES = Math.max(Math.ceil(count / ELEMENTS_PER_PAGE), 1);
		const withIgn = await Promise.all(
			bans.map(async ({ minecraftUuid, reason }) => {
				try {
					const { ign } = await mojang.uuid(minecraftUuid);

					return stripIndents`
						${Formatters.bold(Formatters.hyperlink(escapeIgn(ign), `${STATS_URL_BASE}${minecraftUuid}`))}
						${reason}
					`;
				} catch (error) {
					logger.error(error);

					return stripIndents`
						${Formatters.bold(Formatters.hyperlink(minecraftUuid, `${STATS_URL_BASE}${minecraftUuid}`))}
						${reason}
					`;
				}
			}),
		);

		return (
			InteractionUtil[
				interaction.isCommand() || interaction.user.id !== userId ? 'reply' : 'update'
			] as typeof InteractionUtil['reply']
		)(interaction as ButtonInteraction, {
			embeds: [
				this.client.defaultEmbed.setTitle(`${'Ban list'.padEnd(166, '\u00A0')}\u200B`).setDescription(stripIndents`
					Total: ${count} players

					${withIgn.join('\n\n')}

					Page: ${page} / ${TOTAL_PAGES}
				`),
			],
			components: this._getPaginationButtons(
				interaction.user.id,
				count >= OFFSET ? page : TOTAL_PAGES, // reset to total pages in case of page overflow
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
		const [SUBCOMMAND, USER_ID, PAGE] = args;

		switch (SUBCOMMAND) {
			case 'view':
				return this._runView(interaction, USER_ID, Number(PAGE));

			default:
				throw new Error(`unknown subcommand '${SUBCOMMAND}'`);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: ChatInputCommandInteraction) {
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

				if (!existingBan) {
					return InteractionUtil.reply(interaction, {
						content: `${escapeIgn(ign)} was added to the ban list for \`${REASON ?? 'no reason'}\``,
					});
				}

				return InteractionUtil.reply(interaction, {
					content: `${escapeIgn(ign)}'s ban reason was updated from \`${existingBan.reason}\` to \`${REASON}\``,
				});
			}

			case 'remove': {
				const { ign, uuid } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
				const existingBan = await this.client.db.models.HypixelGuildBan.findByPk(uuid);

				if (!existingBan) {
					return InteractionUtil.reply(interaction, {
						content: `${escapeIgn(ign)} is not on the ban list`,
					});
				}

				await existingBan.destroy();

				return InteractionUtil.reply(interaction, {
					content: `${escapeIgn(ign)}'s ban with reason \`${existingBan.reason}\` has been removed`,
				});
			}

			case 'check': {
				const { ign, uuid } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
				const existingBan = await this.client.db.models.HypixelGuildBan.findByPk(uuid);

				if (!existingBan) {
					return InteractionUtil.reply(interaction, {
						embeds: [
							new Embed()
								.setColor(this.config.get('EMBED_GREEN'))
								.setDescription(
									`${Formatters.bold(
										Formatters.hyperlink(escapeIgn(ign), `${STATS_URL_BASE}${uuid}`),
									)} is not on the ban list`,
								)
								.setTimestamp(),
						],
					});
				}

				return InteractionUtil.reply(interaction, {
					embeds: [
						new Embed()
							.setColor(this.config.get('EMBED_RED'))
							.setDescription(
								stripIndents`
								${Formatters.bold(Formatters.hyperlink(escapeIgn(ign), `${STATS_URL_BASE}${uuid}`))} is on the ban list for
								${existingBan.reason}
							`,
							)
							.setTimestamp(),
					],
				});
			}

			case 'view':
				return this._runView(interaction, interaction.user.id, interaction.options.getInteger('page') ?? 1);

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}
}
