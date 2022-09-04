import { AutoCompleteLimits, EmbedLimits } from '@sapphire/discord-utilities';
import {
	codeBlock,
	InteractionType,
	SlashCommandBuilder,
	SnowflakeUtil,
	time,
	type AutocompleteInteraction,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Interaction,
	type SlashCommandStringOption,
	type Snowflake,
} from 'discord.js';
import ms from 'ms';
import { Op, type Attributes, type WhereOptions } from 'sequelize';
import { mojang } from '#api';
import { HypixelMessage, type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import {
	demote,
	historyErrors,
	invite,
	kick,
	mute,
	logErrors,
	promote,
	setRank,
	topErrors,
	unmute,
	unknownIgn,
} from '#chatBridge/constants/index.js';
import { type CommandOptions } from '#chatBridge/managers/MinecraftChatManager.js';
import { UNKNOWN_IGN } from '#constants';
import {
	autocorrect,
	buildPaginationActionRow,
	commaListOr,
	escapeIgn,
	getIdFromString,
	minutes,
	removeMcFormatting,
	seconds,
	sortCache,
	stringToMS,
	trim,
} from '#functions';
import { logger } from '#logger';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import {
	forceOption,
	hypixelGuildOption,
	optionalPlayerOption,
	pageOption,
	requiredIgnOption,
	requiredPlayerOption,
	targetOption,
} from '#structures/commands/commonOptions.js';
import { type HypixelGuild } from '#structures/database/models/HypixelGuild.js';
import { type Player } from '#structures/database/models/Player.js';
import { GuildMemberUtil, InteractionUtil, UserUtil } from '#utils';

interface RunModerationOptions {
	executor: Player | null;
	hypixelGuild: HypixelGuild;
	target: Player | string;
}

interface RunMuteOptions extends RunModerationOptions {
	duration: number;
}

interface RunKickOptions extends RunModerationOptions {
	ctx: ChatInputCommandInteraction<'cachedOrDM'> | HypixelUserMessage;
	reason: string;
}

export default class GuildCommand extends ApplicationCommand {
	private readonly GUILD_IDENTIFIER = new Set(['guild', 'everyone'] as const);

	public constructor(context: CommandContext) {
		const slash = new SlashCommandBuilder()
			.setDescription('hypixel')
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('demote')
					.setDescription('demote')
					.addStringOption(requiredPlayerOption),
			)
			.addSubcommand((subcommand) =>
				subcommand
					.setName('kick')
					.setDescription('kick')
					.addStringOption(requiredPlayerOption)
					.addStringOption((option) =>
						option //
							.setName('reason')
							.setDescription('reason')
							.setRequired(true),
					)
					.addBooleanOption((option) =>
						option
							.setName('add-to-ban-list')
							.setDescription('add the player with the provided reason to the ban list on success (default: false)'),
					),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('history')
					.setDescription('history')
					.addIntegerOption(pageOption),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('info')
					.setDescription('info'),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('invite')
					.setDescription('invite')
					.addStringOption(requiredIgnOption),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('list')
					.setDescription('list'),
			)
			.addSubcommand((subcommand) =>
				subcommand
					.setName('log')
					.setDescription('log')
					.addStringOption(optionalPlayerOption)
					.addIntegerOption(pageOption),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('member')
					.setDescription('member')
					.addStringOption(optionalPlayerOption),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('members')
					.setDescription('members'),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('motd')
					.setDescription('motd'),
			)
			.addSubcommand((subcommand) =>
				subcommand
					.setName('mute')
					.setDescription('mute')
					.addStringOption(targetOption)
					.addStringOption((option) =>
						option //
							.setName('duration')
							.setDescription('s[econds] | m[inutes] | h[ours] | d[ays]')
							.setRequired(true),
					),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('online')
					.setDescription('online'),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('promote')
					.setDescription('promote')
					.addStringOption(requiredPlayerOption),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('quest')
					.setDescription('quest'),
			)
			.addSubcommand((subcommand) =>
				subcommand
					.setName('setrank')
					.setDescription('setrank')
					.addStringOption(requiredPlayerOption)
					.addStringOption((option) =>
						option //
							.setName('rank')
							.setDescription('rank name')
							.setRequired(true)
							.setAutocomplete(true),
					),
			)
			.addSubcommand((subcommand) =>
				subcommand
					.setName('top')
					.setDescription('top')
					.addIntegerOption((option) =>
						option //
							.setName('days-ago')
							.setDescription('number of days ago')
							.setRequired(false),
					),
			)
			.addSubcommand((subcommand) =>
				subcommand //
					.setName('unmute')
					.setDescription('unmute')
					.addStringOption(targetOption),
			);

		for (const subcommand of (slash as SlashCommandBuilder).options as unknown as SlashCommandBuilder[]) {
			if (
				(subcommand.options as SlashCommandStringOption[]).some(
					(option) => option.name === 'player' || option.name === 'target',
				)
			) {
				subcommand.addBooleanOption(forceOption);
			}

			subcommand.addStringOption(hypixelGuildOption);
		}

		super(context, {
			aliases: ['g'],
			slash,
			requiredRoles: (hypixelGuild) =>
				[
					hypixelGuild.GUILD_ROLE_ID!,
					hypixelGuild.BRIDGER_ROLE_ID!,
					...hypixelGuild.staffRoleIds,
					...hypixelGuild.adminRoleIds,
				].filter(Boolean),
			cooldown: 0,
		});
	}

	/**
	 * throws on unknown subcommand, rejects on missing permissions
	 *
	 * @param interaction
	 * @param hypixelGuild
	 * @param subcommand
	 */
	private async _assertRequiredRoles(
		interaction: Interaction<'cachedOrDM'>,
		hypixelGuild: HypixelGuild,
		subcommand: string,
	) {
		const roleIds: Snowflake[] = [];

		switch (subcommand) {
			case 'kick': // admin commands
				roleIds.push(...hypixelGuild.adminRoleIds);
				break;

			case 'list': // bridger commands (all roles pass, no need to check again)
			case 'members':
			case 'online':
				return;

			case 'history': // g member commands
			case 'info':
			case 'member':
			case 'motd':
			case 'quest':
			case 'top':
				roleIds.push(hypixelGuild.GUILD_ROLE_ID!);
			// fallthrough

			case 'demote': // staff commands
			case 'invite':
			case 'log':
			case 'mute':
			case 'promote':
			case 'setrank':
			case 'unmute':
				roleIds.push(...hypixelGuild.staffRoleIds);
				break;

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}

		// eslint-disable-next-line consistent-return
		return this.assertPermissions(interaction, { roleIds, hypixelGuild });
	}

	/**
	 * @param targetInput
	 * @param interaction
	 */
	public async getMuteTarget(targetInput: string, interaction?: ChatInputCommandInteraction<'cachedOrDM'>) {
		if (this.GUILD_IDENTIFIER.has(targetInput as any)) {
			return 'everyone';
		}

		if (!interaction) return this.client.players.getByIgn(targetInput) ?? targetInput;

		return (
			InteractionUtil.getPlayer(interaction) ??
			(InteractionUtil.checkForce(interaction)
				? targetInput // use input if force is set
				: (await this.client.players.fetch({
						// try to find by ign or uuid
						[Op.or]: [
							{
								ign: { [Op.iLike]: targetInput },
								minecraftUuid: targetInput,
							},
						],
						cache: false,
				  })) ??
				  (async () => {
						// check if input is a discord id or @mention, find or create player db object if so
						const ID = getIdFromString(targetInput);

						if (!ID) return null;

						try {
							// check if ID is from a member in the guild
							await interaction.guild?.members.fetch(ID);

							return (
								await this.client.players.model.findCreateFind({
									where: { discordId: ID },
									defaults: {
										minecraftUuid: SnowflakeUtil.generate().toString(),
										ign: UNKNOWN_IGN,
										inDiscord: true,
									},
								})
							)[0];
						} catch (error) {
							return logger.error(error);
						}
				  })())
		);
	}

	/**
	 * /g mute
	 *
	 * @param options
	 */
	public async runMute({ target, executor, duration, hypixelGuild }: RunMuteOptions) {
		if (this.client.players.isModel(target)) {
			const IN_GUILD = target.inGuild();

			if (IN_GUILD) {
				this._assertExecutorIsStaff(hypixelGuild, executor);

				if (target.guildRankPriority >= executor.guildRankPriority) {
					throw `your guild rank needs to be higher than \`${target}\`'s`;
				}
			}

			// update db and timeout discord member
			await Promise.all([
				hypixelGuild.syncMute(target, Date.now() + duration),
				(async () => {
					const discordMember = await target.fetchDiscordMember();
					return (
						discordMember &&
						GuildMemberUtil.timeout(discordMember, duration, `${executor}: \`/guild mute ${target} ${ms(duration)}\``)
					);
				})(),
			]);

			// don't use chatBridge command if player isn't actually in the guild
			if (!IN_GUILD) {
				return `muted \`${target}\` for \`${duration}\``;
			}
		} else if (target === 'everyone') {
			this._assertExecutorIsStaff(hypixelGuild, executor);

			await hypixelGuild.update({ mutedTill: Date.now() + duration });
		}

		try {
			const { chatBridge } = hypixelGuild;
			// eslint-disable-next-line @typescript-eslint/return-await
			return await chatBridge.minecraft.command({
				command: `guild mute ${target} ${ms(duration)}`,
				responseRegExp: mute(target === 'everyone' ? 'the guild chat' : `${target}`, chatBridge.bot.username),
			});
		} catch (error) {
			throw `${error}`;
		}
	}

	/**
	 * @param interaction
	 * @param hypixelGuild
	 * @param duration
	 */
	public async runMuteInteraction(
		interaction: ChatInputCommandInteraction<'cachedOrDM'>,
		hypixelGuild: HypixelGuild,
		duration: number,
	) {
		const TARGET_INPUT = interaction.options.getString('target', true).toLowerCase();
		const target = await this.getMuteTarget(TARGET_INPUT, interaction);

		if (!target) {
			throw `no player with the IGN \`${TARGET_INPUT}\` found`;
		}

		const result = await this.runMute({
			target,
			executor: UserUtil.getPlayer(interaction.user),
			duration,
			hypixelGuild,
		});

		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/guild mute ${escapeIgn(`${target}`)} ${ms(duration)}`)
					.setDescription(codeBlock(result.replaceAll('`', '')))
					.setFooter({ text: hypixelGuild.name }),
			],
		});
	}

	/**
	 * asserts the executor has an in-game staff rank in the hypixelGuild
	 *
	 * @param hypixelGuild
	 * @param executor
	 */
	private _assertExecutorIsStaff(hypixelGuild: HypixelGuild, executor: Player | null): asserts executor is Player {
		if (!executor) {
			throw 'unable to find a linked player for your discord account';
		}

		if (!hypixelGuild.checkStaff(executor)) {
			const staffRanks = hypixelGuild.ranks
				.filter(({ priority }) => priority > hypixelGuild.ranks.length - hypixelGuild.staffRanksAmount)
				.map(({ name }) => name);

			throw `you need to have an in-game staff rank (${
				staffRanks.length ? commaListOr(staffRanks) : 'none set'
			}) in \`${hypixelGuild}\``;
		}
	}

	/**
	 * @param options
	 */
	public async runKick({ ctx, target, executor, hypixelGuild, reason }: RunKickOptions) {
		this._assertExecutorIsStaff(hypixelGuild, executor);

		if (typeof target === 'string') {
			throw `no player with the IGN \`${target}\` found`;
		}

		if (target.guildRankPriority >= executor.guildRankPriority) {
			throw `your guild rank needs to be higher than \`${target}\`'s`;
		}

		const TIME_LEFT = hypixelGuild.lastKickAt.getTime() + hypixelGuild.kickCooldown - Date.now();

		if (TIME_LEFT > 0) {
			throw `kicking is on cooldown for another ${ms(TIME_LEFT, { long: true })}`;
		}

		try {
			// confirm kick
			const QUESTION = `kick \`${target}\` from ${hypixelGuild.name}?` as const;
			await (ctx instanceof HypixelMessage
				? ctx.awaitConfirmation(QUESTION)
				: InteractionUtil.awaitConfirmation(ctx, QUESTION));

			const { chatBridge } = hypixelGuild;
			const result = await chatBridge.minecraft.command({
				command: `guild kick ${target} ${reason}`,
				responseRegExp: kick.success(target.ign, chatBridge.bot.username),
				abortRegExp: kick.error(target.ign),
				rejectOnAbort: true,
				timeout: minutes(1),
				rejectOnTimeout: true,
			});

			hypixelGuild.update({ lastKickAt: new Date() }).catch((error) => logger.error(error));

			return result;
		} catch (error) {
			throw `${error}`;
		}
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param commandOptions
	 * @param hypixelGuild
	 */
	private async _sharedRun(
		interaction: ChatInputCommandInteraction<'cachedOrDM'>,
		hypixelGuild: HypixelGuild,
		commandOptions: CommandOptions,
	) {
		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${escapeIgn(commandOptions.command)}`) // command can inclue a player IGN
					.setDescription(codeBlock(await hypixelGuild.chatBridge.minecraft.command(commandOptions)))
					.setFooter({ text: hypixelGuild.name }),
			],
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param commandOptions
	 */
	private async _runList(
		interaction: ChatInputCommandInteraction<'cachedOrDM'>,
		hypixelGuild: HypixelGuild,
		commandOptions: CommandOptions,
	) {
		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${commandOptions.command}`)
					.setDescription(
						codeBlock(
							trim(
								(
									await hypixelGuild.chatBridge.minecraft.command({
										...commandOptions,
										raw: true,
									})
								)
									.map((msg) =>
										msg.content.includes('●')
											? removeMcFormatting(
													msg.formattedContent
														.replaceAll('§r§c ●', ' 🔴') // prettify emojis
														.replaceAll('§r§a ●', ' 🟢')
														.replace(/\[.+?] /g, '') // remove hypixel ranks (helps with staying inside the character limit)
														.trim(),
											  )
											: msg.content,
									)
									.join('\n'),
								EmbedLimits.MaximumDescriptionLength - 8, // 2 * (3 [```] + 1 [\n])
							),
						),
					)
					.setFooter({ text: hypixelGuild.name }),
			],
		});
	}

	/**
	 * @param interaction
	 * @param value - input value
	 * @param name - option name
	 */
	public override async autocompleteRun(
		interaction: AutocompleteInteraction<'cachedOrDM'>,
		value: string,
		name: string,
	) {
		switch (name) {
			case 'rank':
				if (!value) {
					return interaction.respond(
						InteractionUtil.getHypixelGuild(interaction)
							.ranks.slice(0, AutoCompleteLimits.MaximumAmountOfOptions)
							.map(({ name: rankName }) => ({ name: rankName, value: rankName })),
					);
				}

				return interaction.respond(
					sortCache(InteractionUtil.getHypixelGuild(interaction).ranks, value, 'name', 'name'),
				);

			default:
				return interaction.respond([]);
		}
	}

	/**
	 * @param interaction
	 * @param hypixelGuild
	 * @param subcommand
	 * @param commandOptions
	 * @param userId
	 * @param page
	 */
	private async _paginatedRun(
		interaction: ButtonInteraction<'cachedOrDM'> | ChatInputCommandInteraction<'cachedOrDM'>,
		hypixelGuild: HypixelGuild,
		subcommand: string,
		commandOptions: CommandOptions,
		userId: Snowflake,
		page: number | null,
	) {
		const command = `${commandOptions.command} ${page ?? ''}`.trimEnd();
		const response = await hypixelGuild.chatBridge.minecraft.command({
			...commandOptions,
			command,
		});
		const pageMatched = /\(Page (?<current>\d+) ?(?:of|\/) ?(?<total>\d+)\)/.exec(response);

		// split input and parse dates
		const descriptionParts: string[] = [];

		// build embed
		const embed = this.client.defaultEmbed
			.setTitle(`/${command}`)
			.setDescription(codeBlock(descriptionParts.join('\n')))
			.setFooter({ text: hypixelGuild.name });

		for (const line of response.split('\n')) {
			const matched = /^(?<date>[a-z]+ \d+ \d{4} \d{2}:\d{2} [a-z]+): (?<event>.+)$/i.exec(line);

			if (!matched) {
				descriptionParts.push(line);
				continue;
			}

			const { date, event } = matched.groups!;

			embed.addFields({
				name: time(seconds.fromMilliseconds(Date.parse(date!))),
				value: codeBlock(event!),
			});
		}

		if (descriptionParts.length) {
			let description = codeBlock(descriptionParts.join('\n'));

			// add a separating line between fields and description
			if (embed.data.fields?.length) description += '\n\u200B';

			embed.setDescription(description);
		}

		const currentPage = Number(pageMatched?.groups!.current ?? page) || 0;
		const totalPages = Number(pageMatched?.groups!.total ?? 0) || currentPage + 7;

		// send reply
		return (
			InteractionUtil[
				interaction.type === InteractionType.ApplicationCommand || interaction.user.id !== userId ? 'reply' : 'update'
			] as typeof InteractionUtil['reply']
		)(interaction as ButtonInteraction<'cachedOrDM'>, {
			embeds: [embed],
			components: [
				buildPaginationActionRow(
					`${this.baseCustomId}:${subcommand}:${hypixelGuild.guildId}:${interaction.user.id}`,
					currentPage,
					totalPages,
					{ firstPage: pageMatched === null ? 0 : 1 },
				),
			],
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param args - parsed customId, split by ':'
	 */
	public override async buttonRun(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]) {
		const [SUBCOMMAND_WITH_ARGS, HYPIXEL_GUILD_ID, USER_ID, PAGE_INPUT] = args as [string, string, string, string];
		const [SUBCOMMAND] = SUBCOMMAND_WITH_ARGS.split(' ', 1) as [string];
		const hypixelGuild = this.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID);

		if (!hypixelGuild) {
			throw new Error('uncached hypixel guild');
		}

		await this._assertRequiredRoles(interaction, hypixelGuild, SUBCOMMAND);

		const PAGE = PAGE_INPUT === Number.NaN.toString() ? null : Number(PAGE_INPUT);

		// check only the part before the first space
		switch (SUBCOMMAND) {
			case 'history':
				return this._paginatedRun(
					interaction,
					hypixelGuild,
					SUBCOMMAND,
					{
						command: 'guild history',
						abortRegExp: historyErrors(),
					},
					USER_ID,
					PAGE,
				);

			case 'log':
				return this._paginatedRun(
					interaction,
					hypixelGuild,
					SUBCOMMAND_WITH_ARGS,
					{
						command: `guild ${SUBCOMMAND_WITH_ARGS}`,
						abortRegExp: logErrors(),
					},
					USER_ID,
					PAGE,
				);

			case 'top':
				return this._paginatedRun(
					interaction,
					hypixelGuild,
					SUBCOMMAND,
					{
						command: 'guild top',
						abortRegExp: topErrors(),
					},
					USER_ID,
					PAGE,
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
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const SUBCOMMAND = interaction.options.getSubcommand();

		await this._assertRequiredRoles(interaction, hypixelGuild, SUBCOMMAND);

		switch (SUBCOMMAND) {
			case 'demote': {
				const executor = UserUtil.getPlayer(interaction.user);

				this._assertExecutorIsStaff(hypixelGuild, executor);

				const target = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });

				if (target.guildRankPriority >= executor.guildRankPriority) {
					throw `your guild rank needs to be higher than \`${target}\`'s`;
				}

				return this._sharedRun(interaction, hypixelGuild, {
					command: `guild demote ${target}`,
					responseRegExp: demote(target.ign),
				});
			}

			case 'kick': {
				const target = InteractionUtil.getPlayer(interaction) ?? interaction.options.getString('player', true);
				const reason = interaction.options.getString('reason', true);
				const result = await this.runKick({
					ctx: interaction,
					target,
					executor: UserUtil.getPlayer(interaction.user),
					reason,
					hypixelGuild,
				});

				// add to ban list
				void (async () => {
					switch (interaction.options.getBoolean('add-to-ban-list')) {
						case false: // option false choosen
							return;

						case null: // no option chosen
							try {
								await InteractionUtil.awaitConfirmation(
									interaction,
									`add \`${target}\` to the ban list for \`${reason}\`?`,
								);
							} catch (error) {
								return logger.error(error);
							}

						// fallthrough
						case true: // option true chosen
							try {
								await this.client.db.models.HypixelGuildBan.upsert({
									minecraftUuid: (target as Player).minecraftUuid,
									_reason: reason,
								});

								void InteractionUtil.reply(interaction, {
									content: `\`${target}\` was added to the ban list for \`${reason}\``,
								});
							} catch (error) {
								logger.error(error);

								void InteractionUtil.reply(interaction, {
									content: `error adding \`${target}\` to the ban list: ${error}`,
								});
							}
					}
				})();

				return InteractionUtil.reply(interaction, {
					embeds: [
						this.client.defaultEmbed
							.setTitle(`/guild kick ${escapeIgn(typeof target === 'string' ? target : target.ign)} ${reason}`)
							.setDescription(codeBlock(result.replaceAll('`', '')))
							.setFooter({ text: hypixelGuild.name }),
					],
				});
			}

			case 'history':
				return this._paginatedRun(
					interaction,
					hypixelGuild,
					SUBCOMMAND,
					{
						command: 'guild history',
						abortRegExp: historyErrors(),
					},
					interaction.user.id,
					interaction.options.getInteger('page'),
				);

			case 'info':
			case 'quest':
				return this._sharedRun(interaction, hypixelGuild, {
					command: `guild ${SUBCOMMAND}`,
				});

			case 'motd':
				return this._sharedRun(interaction, hypixelGuild, {
					command: 'guild motd preview',
				});

			case 'top':
				return this._paginatedRun(
					interaction,
					hypixelGuild,
					SUBCOMMAND,
					{
						command: 'guild top',
						abortRegExp: topErrors(),
					},
					interaction.user.id,
					interaction.options.getInteger('days-ago'),
				);

			case 'invite': {
				const { ign, uuid } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
				const existingBan = await this.client.db.models.HypixelGuildBan.findByPk(uuid);

				if (existingBan) {
					throw `\`${ign}\` is on the ban list for \`${existingBan.reason}\``;
				}

				return this._sharedRun(interaction, hypixelGuild, {
					command: `guild invite ${ign}`,
					responseRegExp: invite(ign),
				});
			}

			case 'list':
			case 'members':
			case 'online':
				return this._runList(interaction, hypixelGuild, {
					command: `guild ${SUBCOMMAND}`,
				});

			case 'log': {
				const COMMAND = `log ${InteractionUtil.getIgn(interaction) ?? ''}`.trimEnd();

				return this._paginatedRun(
					interaction,
					hypixelGuild,
					COMMAND,
					{
						command: `guild ${COMMAND}`,
						abortRegExp: logErrors(),
					},
					interaction.user.id,
					interaction.options.getInteger('page'),
				);
			}

			case 'member': {
				const target = InteractionUtil.getPlayer(interaction, { fallbackToCurrentUser: true, throwIfNotFound: true });

				return this._sharedRun(interaction, hypixelGuild, {
					command: `guild member ${target}`,
					abortRegExp: unknownIgn(target.ign),
				});
			}

			case 'mute': {
				const DURATION_INPUT = interaction.options.getString('duration', true);
				const DURATION = stringToMS(DURATION_INPUT);

				if (Number.isNaN(DURATION)) {
					throw `\`${DURATION_INPUT}\` is not a valid duration`;
				}

				return this.runMuteInteraction(interaction, hypixelGuild, DURATION);
			}

			case 'promote': {
				const executor = UserUtil.getPlayer(interaction.user);

				this._assertExecutorIsStaff(hypixelGuild, executor);

				const target = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });

				if (target.guildRankPriority >= executor.guildRankPriority - 1) {
					throw 'you can only promote up to your own rank';
				}

				return this._sharedRun(interaction, hypixelGuild, {
					command: `guild promote ${target}`,
					responseRegExp: promote(target.ign),
				});
			}

			case 'setrank': {
				const executor = UserUtil.getPlayer(interaction.user);

				this._assertExecutorIsStaff(hypixelGuild, executor);

				const target = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });
				const RANK_INPUT = interaction.options.getString('rank', true);
				const { value: rank, similarity } = autocorrect(RANK_INPUT, hypixelGuild.ranks, 'name');

				if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) {
					throw `unknown guild rank '${RANK_INPUT}'`;
				}

				if (target.guildRankPriority >= executor.guildRankPriority || rank.priority >= executor.guildRankPriority) {
					throw 'you can only change ranks up to your own rank';
				}

				return this._sharedRun(interaction, hypixelGuild, {
					command: `guild setrank ${target} ${rank.name}`,
					responseRegExp: setRank(target.ign, undefined, rank.name),
				});
			}

			case 'unmute': {
				const TARGET_INPUT = interaction.options.getString('target', true).toLowerCase();

				let target: Player | string | null;

				if (this.GUILD_IDENTIFIER.has(TARGET_INPUT as any)) {
					target = 'everyone';
				} else {
					target = InteractionUtil.getPlayer(interaction);

					if (!target) {
						if (InteractionUtil.checkForce(interaction)) {
							target = TARGET_INPUT;
						} else {
							// fetch uncached player
							const queryParams: WhereOptions<Attributes<Player>>[] = [
								{
									ign: { [Op.iLike]: TARGET_INPUT },
									minecraftUuid: TARGET_INPUT,
								},
							];

							// check if input is a discord id or @mention
							const ID = getIdFromString(TARGET_INPUT);
							if (ID) queryParams.push({ discordId: ID });

							target = await this.client.players.fetch({
								[Op.or]: queryParams,
								cache: false,
							});
						}
					}

					if (!target) {
						throw `no player with the IGN \`${TARGET_INPUT}\` found`;
					}
				}

				if (this.client.players.isModel(target)) {
					const IN_GUILD = target.inGuild();
					const executor = UserUtil.getPlayer(interaction.user);

					if (IN_GUILD) {
						this._assertExecutorIsStaff(hypixelGuild, executor);

						if (target.guildRankPriority >= executor.guildRankPriority) {
							throw `your guild rank needs to be higher than \`${target}\`'s`;
						}
					}

					// update db and remove timeout from discord member
					await Promise.all([
						hypixelGuild.syncMute(target, null),
						(async () => {
							const discordMember = await target.fetchDiscordMember();
							if (!discordMember) return;
							return GuildMemberUtil.timeout(discordMember, null, `${executor}: \`/guild unmute ${target}\``);
						})(),
					]);

					if (!IN_GUILD) return InteractionUtil.reply(interaction, `unmuted \`${target}\``);
				} else if (target === 'everyone') {
					this._assertExecutorIsStaff(hypixelGuild, UserUtil.getPlayer(interaction.user));

					await hypixelGuild.update({ mutedTill: 0 });
				}

				return this._sharedRun(interaction, hypixelGuild, {
					command: `guild unmute ${target}`,
					responseRegExp: unmute(
						target === 'everyone' ? 'the guild chat' : `${target}`,
						hypixelGuild.chatBridge.bot.username,
					),
				});
			}

			default:
				throw new Error(`unknown subcommand '${SUBCOMMAND}'`);
		}
	}
}
