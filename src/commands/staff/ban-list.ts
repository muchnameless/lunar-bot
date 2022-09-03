import { stripIndents } from 'common-tags';
import {
	bold,
	EmbedBuilder,
	hyperlink,
	InteractionType,
	SlashCommandBuilder,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Snowflake,
} from 'discord.js';
import { mojang } from '#api';
import { STATS_URL_BASE } from '#constants';
import { buildPaginationActionRow, escapeIgn } from '#functions';
import { logger } from '#logger';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { pageOption, requiredIgnOption } from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

export default class BanListCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
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
	 * /friend list [page]
	 *
	 * @param interaction
	 * @param userId
	 * @param page
	 */
	private async _runView(
		interaction: ButtonInteraction<'cachedOrDM'> | ChatInputCommandInteraction<'cachedOrDM'>,
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
						${bold(hyperlink(escapeIgn(ign), `${STATS_URL_BASE}${minecraftUuid}`))}
						${reason}
					`;
				} catch (error) {
					logger.error(error);

					return stripIndents`
						${bold(hyperlink(minecraftUuid, `${STATS_URL_BASE}${minecraftUuid}`))}
						${reason}
					`;
				}
			}),
		);

		return (
			InteractionUtil[
				interaction.type === InteractionType.ApplicationCommand || interaction.user.id !== userId ? 'reply' : 'update'
			] as typeof InteractionUtil['reply']
		)(interaction as ButtonInteraction<'cachedOrDM'>, {
			embeds: [
				this.client.defaultEmbed //
					.setTitle(`${'Ban list'.padEnd(166, '\u00A0')}\u200B`) //
					.setDescription(stripIndents`
						Total: ${count} players

						${withIgn.join('\n\n')}

						Page: ${page} / ${TOTAL_PAGES}
					`),
			],
			components: [
				buildPaginationActionRow(
					`${this.baseCustomId}:view:${interaction.user.id}`,
					count >= OFFSET ? page : TOTAL_PAGES, // reset to total pages in case of page overflow
					TOTAL_PAGES,
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
		const [SUBCOMMAND, USER_ID, PAGE] = args as [string, Snowflake, `${bigint}`];

		switch (SUBCOMMAND) {
			case 'view':
				return this._runView(interaction, USER_ID, Number(PAGE));

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
							new EmbedBuilder()
								.setColor(this.config.get('EMBED_GREEN'))
								.setDescription(`${bold(hyperlink(escapeIgn(ign), `${STATS_URL_BASE}${uuid}`))} is not on the ban list`)
								.setTimestamp(),
						],
					});
				}

				return InteractionUtil.reply(interaction, {
					embeds: [
						new EmbedBuilder()
							.setColor(this.config.get('EMBED_RED'))
							.setDescription(
								stripIndents`
								${bold(hyperlink(escapeIgn(ign), `${STATS_URL_BASE}${uuid}`))} is on the ban list for
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
