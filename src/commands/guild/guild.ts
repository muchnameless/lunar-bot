import { SlashCommandBuilder } from '@discordjs/builders';
import { SnowflakeUtil, Formatters, Constants, MessageActionRow, MessageButton } from 'discord.js';
import pkg from 'sequelize';
const { Op } = pkg;
import ms from 'ms';
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
} from '../../structures/chat_bridge/constants';
import {
	DOUBLE_LEFT_EMOJI,
	DOUBLE_RIGHT_EMOJI,
	EMBED_DESCRIPTION_MAX_CHARS,
	GUILD_ID_BRIDGER,
	LEFT_EMOJI,
	RELOAD_EMOJI,
	RIGHT_EMOJI,
	UNKNOWN_IGN,
} from '../../constants';
import {
	forceOption,
	hypixelGuildOption,
	optionalPlayerOption,
	pageOption,
	requiredIgnOption,
	requiredPlayerOption,
	targetOption,
} from '../../structures/commands/commonOptions';
import { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';
import { mojang } from '../../api';
import { InteractionUtil, UserUtil } from '../../util';
import {
	autocorrect,
	escapeIgn,
	getIdFromString,
	logger,
	removeMcFormatting,
	seconds,
	stringToMS,
	trim,
} from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { ButtonInteraction, CommandInteraction, Interaction, Snowflake } from 'discord.js';
import type { SlashCommandStringOption } from '@discordjs/builders';
import type { WhereOptions } from 'sequelize';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { Player } from '../../structures/database/models/Player';
import type { HypixelGuild } from '../../structures/database/models/HypixelGuild';
import type { CommandOptions } from '../../structures/chat_bridge/managers/MinecraftChatManager';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';

interface RunModerationOptions {
	target: Player | string;
	executor: Player | null;
	hypixelGuild: HypixelGuild;
}

interface RunMuteOptions extends RunModerationOptions {
	duration: number;
}

interface RunKickOptions extends RunModerationOptions {
	ctx: CommandInteraction | HypixelUserMessage;
	reason: string;
}

export default class GuildCommand extends ApplicationCommand {
	GUILD_IDENTIFIER = new Set(['guild', 'everyone'] as const);

	constructor(context: CommandContext) {
		const slash = new SlashCommandBuilder()
			.setDescription('hypixel')
			.addSubcommand((subcommand) =>
				subcommand.setName('demote').setDescription('demote').addStringOption(requiredPlayerOption),
			)
			.addSubcommand((subcommand) =>
				subcommand
					.setName('kick')
					.setDescription('kick')
					.addStringOption(requiredPlayerOption)
					.addStringOption((option) => option.setName('reason').setDescription('reason').setRequired(true))
					.addBooleanOption((option) =>
						option
							.setName('add-to-ban-list')
							.setDescription('add the player with the provided reason to the ban list on success (default: false)'),
					),
			)
			.addSubcommand((subcommand) =>
				subcommand.setName('history').setDescription('history').addIntegerOption(pageOption),
			)
			.addSubcommand((subcommand) => subcommand.setName('info').setDescription('info'))
			.addSubcommand((subcommand) =>
				subcommand.setName('invite').setDescription('invite').addStringOption(requiredIgnOption),
			)
			.addSubcommand((subcommand) => subcommand.setName('list').setDescription('list'))
			.addSubcommand((subcommand) =>
				subcommand
					.setName('log')
					.setDescription('log')
					.addStringOption(optionalPlayerOption)
					.addIntegerOption(pageOption),
			)
			.addSubcommand((subcommand) =>
				subcommand.setName('member').setDescription('member').addStringOption(optionalPlayerOption),
			)
			.addSubcommand((subcommand) => subcommand.setName('members').setDescription('members'))
			.addSubcommand((subcommand) => subcommand.setName('motd').setDescription('motd'))
			.addSubcommand((subcommand) =>
				subcommand
					.setName('mute')
					.setDescription('mute')
					.addStringOption(targetOption)
					.addStringOption((option) =>
						option.setName('duration').setDescription('s[econds] | m[inutes] | h[ours] | d[ays]').setRequired(true),
					),
			)
			.addSubcommand((subcommand) => subcommand.setName('online').setDescription('online'))
			.addSubcommand((subcommand) =>
				subcommand.setName('promote').setDescription('promote').addStringOption(requiredPlayerOption),
			)
			.addSubcommand((subcommand) => subcommand.setName('quest').setDescription('quest'))
			.addSubcommand((subcommand) =>
				subcommand
					.setName('setrank')
					.setDescription('setrank')
					.addStringOption(requiredPlayerOption)
					.addStringOption((option) => option.setName('rank').setDescription('rank name').setRequired(true)),
			)
			.addSubcommand((subcommand) =>
				subcommand
					.setName('top')
					.setDescription('top')
					.addIntegerOption((option) =>
						option.setName('days_ago').setDescription('number of days ago').setRequired(false),
					),
			)
			.addSubcommand((subcommand) =>
				subcommand.setName('unmute').setDescription('unmute').addStringOption(targetOption),
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
			cooldown: 0,
		});
	}

	/**
	 * throws on unknown subcommand, rejects on missing permissions
	 * @param interaction
	 * @param hypixelGuild
	 * @param subcommand
	 */
	#checkRequiredRoles(interaction: Interaction, hypixelGuild: HypixelGuild, subcommand: string) {
		switch (subcommand) {
			case 'demote':
			case 'invite':
			case 'log':
			case 'mute':
			case 'promote':
			case 'setrank':
			case 'unmute':
				return this.checkPermissions(interaction, {
					roleIds: hypixelGuild.staffRoleIds,
					hypixelGuild,
				});

			case 'kick':
				return this.checkPermissions(interaction, {
					roleIds: hypixelGuild.adminRoleIds,
					hypixelGuild,
				});

			case 'history':
			case 'info':
			case 'member':
			case 'motd':
			case 'quest':
			case 'top':
				return this.checkPermissions(interaction, {
					roleIds: [hypixelGuild.GUILD_ROLE_ID!, ...hypixelGuild.staffRoleIds],
					hypixelGuild,
				});

			case 'list':
			case 'members':
			case 'online':
				return this.checkPermissions(interaction, {
					roleIds: [hypixelGuild.GUILD_ROLE_ID!, hypixelGuild.BRIDGER_ROLE_ID!, ...hypixelGuild.staffRoleIds],
					hypixelGuild,
				});

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * @param targetInput
	 * @param interaction
	 */
	async getMuteTarget(targetInput: string, interaction?: CommandInteraction) {
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
										minecraftUuid: SnowflakeUtil.generate(),
										guildId: GUILD_ID_BRIDGER,
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
	 * @param options
	 */
	async runMute({ target, executor, duration, hypixelGuild }: RunMuteOptions) {
		if (this.client.players.isModel(target)) {
			const inGuild = target.inGuild();

			if (inGuild && target.guildRankPriority >= (executor?.guildRankPriority ?? -1)) {
				return {
					content: `your guild rank needs to be higher than \`${target}\`'s`,
					ephemeral: true,
				};
			}

			await target.update({ mutedTill: Date.now() + duration });

			// don't use chatBridge command if player isn't actually in the guild
			if (!inGuild) {
				return {
					content: `muted \`${target}\` for \`${duration}\``,
					ephemeral: false,
				};
			}
		} else if (target === 'everyone') {
			await hypixelGuild.update({ mutedTill: Date.now() + duration });
		}

		try {
			const { chatBridge } = hypixelGuild;
			const res = await chatBridge.minecraft.command({
				command: `guild mute ${target} ${ms(duration)}`,
				responseRegExp: mute(target === 'everyone' ? 'the guild chat' : `${target}`, chatBridge.bot.username),
			});

			return {
				content: res,
				ephemeral: false,
			};
		} catch (error) {
			return {
				content: `${error}`,
				ephemeral: true,
			};
		}
	}

	/**
	 * @param interaction
	 * @param hypixelGuild
	 * @param duration
	 */
	async runMuteInteraction(interaction: CommandInteraction, hypixelGuild: HypixelGuild, duration: number) {
		const TARGET_INPUT = interaction.options.getString('target', true).toLowerCase();
		const target = await this.getMuteTarget(TARGET_INPUT, interaction);

		if (!target) {
			return InteractionUtil.reply(interaction, {
				content: `no player with the IGN \`${TARGET_INPUT}\` found`,
				ephemeral: true,
			});
		}

		const { content, ephemeral } = await this.runMute({
			target,
			executor: UserUtil.getPlayer(interaction.user),
			duration,
			hypixelGuild,
		});

		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/guild mute ${target} ${ms(duration)}`)
					.setDescription(Formatters.codeBlock(content))
					.setFooter(hypixelGuild.name),
			],
			ephemeral:
				interaction.options.get('visibility') === null
					? InteractionUtil.CACHE.get(interaction)!.useEphemeral || ephemeral
					: InteractionUtil.CACHE.get(interaction)!.useEphemeral,
		});
	}

	/**
	 * @param options
	 */
	async runKick({ ctx, target, executor, hypixelGuild, reason }: RunKickOptions) {
		if (!executor) {
			return {
				content: 'unable to find a linked player to your discord account',
				hasErrored: true,
			};
		}
		if (!executor.isStaff) {
			return {
				content: 'you need to have an in game staff rank for this command',
				hasErrored: true,
			};
		}
		if (executor.guildId !== hypixelGuild.guildId) {
			return {
				content: `you need to be in ${hypixelGuild} to kick a player from there`,
				hasErrored: true,
			};
		}

		if (typeof target === 'string') {
			return {
				content: `no player with the IGN \`${target}\` found`,
				hasErrored: true,
			};
		}
		if (target.guildRankPriority >= executor.guildRankPriority) {
			return {
				content: `your guild rank needs to be higher than \`${target}\`'s`,
				hasErrored: true,
			};
		}

		const TIME_LEFT = this.config.get('LAST_KICK_TIME') + this.config.get('KICK_COOLDOWN') - Date.now();

		if (TIME_LEFT > 0) {
			return {
				content: `kicking is on cooldown for another ${ms(TIME_LEFT, { long: true })}`,
				hasErrored: true,
			};
		}

		try {
			// confirm kick
			const QUESTION = `kick \`${target}\` from ${escapeIgn(hypixelGuild.name)}?` as const;
			await (ctx instanceof HypixelMessage
				? ctx.awaitConfirmation(QUESTION)
				: InteractionUtil.awaitConfirmation(ctx, QUESTION));

			const { chatBridge } = hypixelGuild;
			const res = await chatBridge.minecraft.command({
				command: `guild kick ${target} ${reason}`,
				responseRegExp: kick.success(target.ign, chatBridge.bot.username),
				abortRegExp: kick.error(target.ign),
				rejectOnAbort: true,
				timeout: seconds(60),
				rejectOnTimeout: true,
			});

			this.config.set('LAST_KICK_TIME', Date.now());

			return {
				content: res,
				hasErrored: false,
			};
		} catch (error) {
			return {
				content: `${error}`,
				hasErrored: true,
			};
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param commandOptions
	 * @param hypixelGuild
	 */
	async #run(interaction: CommandInteraction, hypixelGuild: HypixelGuild, commandOptions: CommandOptions) {
		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${escapeIgn(commandOptions.command)}`) // command can inclue a player IGN
					.setDescription(Formatters.codeBlock(await hypixelGuild.chatBridge.minecraft.command(commandOptions)))
					.setFooter(hypixelGuild.name),
			],
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param commandOptions
	 */
	async #runList(interaction: CommandInteraction, hypixelGuild: HypixelGuild, commandOptions: CommandOptions) {
		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${commandOptions.command}`)
					.setDescription(
						Formatters.codeBlock(
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
														.replace(/\[.+?\] /g, '') // remove hypixel ranks (helps with staying inside the character limit)
														.trim(),
											  )
											: msg.content,
									)
									.join('\n'),
								EMBED_DESCRIPTION_MAX_CHARS - 8, // 2 * (3 [```] + 1 [\n])
							),
						),
					)
					.setFooter(hypixelGuild.name),
			],
		});
	}

	/**
	 * @param hypixelGuildId
	 * @param userId
	 * @param currentPage
	 * @param totalPages
	 */
	#getPaginationButtons(
		subcommand: string,
		hypixelGuildId: string,
		userId: Snowflake,
		currentPage: number,
		totalPages: number,
		isParsedPages: boolean,
	) {
		const CUSTOM_ID = `${this.baseCustomId}:${subcommand}:${hypixelGuildId}:${userId}` as const;

		let currentPage_ = currentPage;
		let totalPages_ = totalPages;
		let decDisabled;
		let incDisabled;

		if (isParsedPages) {
			const INVALID_PAGES = Number.isNaN(currentPage) || Number.isNaN(totalPages);

			decDisabled = currentPage === 1 || INVALID_PAGES;
			incDisabled = currentPage === totalPages || INVALID_PAGES;
		} else {
			// not parsed
			if (Number.isNaN(currentPage)) currentPage_ = 0;
			if (Number.isNaN(totalPages)) totalPages_ = currentPage_ + 7;

			decDisabled = currentPage_ === 0;
			incDisabled = currentPage_ === totalPages_;
		}

		return [
			new MessageActionRow().addComponents(
				new MessageButton()
					.setCustomId(`${CUSTOM_ID}:${isParsedPages ? 1 : 0}:${DOUBLE_LEFT_EMOJI}`)
					.setEmoji(DOUBLE_LEFT_EMOJI)
					.setStyle(Constants.MessageButtonStyles.PRIMARY)
					.setDisabled(decDisabled),
				new MessageButton()
					.setCustomId(`${CUSTOM_ID}:${currentPage_ - 1}:${LEFT_EMOJI}`)
					.setEmoji(LEFT_EMOJI)
					.setStyle(Constants.MessageButtonStyles.PRIMARY)
					.setDisabled(decDisabled),
				new MessageButton()
					.setCustomId(`${CUSTOM_ID}:${currentPage_ + 1}:${RIGHT_EMOJI}`)
					.setEmoji(RIGHT_EMOJI)
					.setStyle(Constants.MessageButtonStyles.PRIMARY)
					.setDisabled(incDisabled),
				new MessageButton()
					.setCustomId(`${CUSTOM_ID}:${totalPages_}:${DOUBLE_RIGHT_EMOJI}`)
					.setEmoji(DOUBLE_RIGHT_EMOJI)
					.setStyle(Constants.MessageButtonStyles.PRIMARY)
					.setDisabled(incDisabled),
				new MessageButton()
					.setCustomId(`${CUSTOM_ID}:${currentPage_}:${RELOAD_EMOJI}`)
					.setEmoji(RELOAD_EMOJI)
					.setStyle(Constants.MessageButtonStyles.PRIMARY),
			),
		];
	}

	/**
	 * @param interaction
	 * @param hypixelGuild
	 * @param subcommand
	 * @param baseCommand
	 * @param userId
	 * @param page
	 */
	async #runPaginated(
		interaction: CommandInteraction | ButtonInteraction,
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
		const pageMatched = response.match(/\(Page (?<current>\d+) ?(?:of|\/) ?(?<total>\d+)\)/);

		return (
			InteractionUtil[
				interaction.isApplicationCommand() || interaction.user.id !== userId ? 'reply' : 'update'
			] as typeof InteractionUtil['reply']
		)(interaction as ButtonInteraction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${command}`)
					.setDescription(Formatters.codeBlock(response))
					.setFooter(hypixelGuild.name),
			],
			components: this.#getPaginationButtons(
				subcommand,
				hypixelGuild.guildId,
				interaction.user.id,
				Number(pageMatched?.groups!.current ?? page),
				Number(pageMatched?.groups!.total),
				pageMatched !== null,
			),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	override async runButton(interaction: ButtonInteraction, args: string[]) {
		const [SUBCOMMAND_WITH_ARGS, HYPIXEL_GUILD_ID, USER_ID, PAGE_INPUT] = args;
		const [SUBCOMMAND] = SUBCOMMAND_WITH_ARGS.split(' ', 1);
		const hypixelGuild = this.client.hypixelGuilds.cache.get(HYPIXEL_GUILD_ID);

		if (!hypixelGuild) {
			throw new Error('uncached hypixel guild');
		}

		await this.#checkRequiredRoles(interaction, hypixelGuild, SUBCOMMAND);

		const PAGE = PAGE_INPUT === Number.NaN.toString() ? null : Number(PAGE_INPUT);

		// check only the part before the first space
		switch (SUBCOMMAND) {
			case 'history':
				return this.#runPaginated(
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
				return this.#runPaginated(
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
				return this.#runPaginated(
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
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const SUBCOMMAND = interaction.options.getSubcommand();

		await this.#checkRequiredRoles(interaction, hypixelGuild, SUBCOMMAND);

		switch (SUBCOMMAND) {
			case 'demote': {
				const executor = UserUtil.getPlayer(interaction.user);

				if (!executor) {
					return InteractionUtil.reply(interaction, {
						content: 'unable to find a linked player for your discord account',
						ephemeral: true,
					});
				}
				if (!executor.isStaff) {
					return InteractionUtil.reply(interaction, {
						content: 'you need to have an in game staff rank for this command',
						ephemeral: true,
					});
				}

				const target = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });

				if (target.guildRankPriority >= executor.guildRankPriority) {
					return InteractionUtil.reply(interaction, {
						content: `your guild rank needs to be higher than \`${target}\`'s`,
						ephemeral: true,
					});
				}

				return this.#run(interaction, hypixelGuild, {
					command: `guild demote ${target}`,
					responseRegExp: demote(target.ign),
				});
			}

			case 'kick': {
				const target = InteractionUtil.getPlayer(interaction) ?? interaction.options.getString('player', true);
				const reason = interaction.options.getString('reason', true);
				const { content, hasErrored } = await this.runKick({
					ctx: interaction,
					target,
					executor: UserUtil.getPlayer(interaction.user),
					reason,
					hypixelGuild,
				});

				// add to ban list
				(async () => {
					if (hasErrored) return;

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

								InteractionUtil.reply(interaction, {
									content: `\`${target}\` was added to the ban list for \`${reason}\``,
								});
							} catch (error) {
								logger.error(error);

								InteractionUtil.reply(interaction, {
									content: `error adding \`${target}\` to the ban list: ${error}`,
								});
							}
					}
				})();

				return InteractionUtil.reply(interaction, {
					embeds: [
						this.client.defaultEmbed
							.setTitle(`/guild kick ${escapeIgn(typeof target === 'string' ? target : target.ign)} ${reason}`)
							.setDescription(Formatters.codeBlock(content))
							.setFooter(hypixelGuild.name),
					],
					ephemeral:
						interaction.options.get('visibility') === null
							? InteractionUtil.CACHE.get(interaction)!.useEphemeral || hasErrored
							: InteractionUtil.CACHE.get(interaction)!.useEphemeral,
				});
			}

			case 'history':
				return this.#runPaginated(
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
				return this.#run(interaction, hypixelGuild, {
					command: `guild ${SUBCOMMAND}`,
				});

			case 'motd':
				return this.#run(interaction, hypixelGuild, {
					command: 'guild motd preview',
				});

			case 'top':
				return this.#runPaginated(
					interaction,
					hypixelGuild,
					SUBCOMMAND,
					{
						command: 'guild top',
						abortRegExp: topErrors(),
					},
					interaction.user.id,
					interaction.options.getInteger('days_ago'),
				);

			case 'invite': {
				const { ign, uuid } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
				const existingBan = await this.client.db.models.HypixelGuildBan.findByPk(uuid);

				if (existingBan) {
					return InteractionUtil.reply(interaction, {
						content: `${escapeIgn(ign)} is on the ban list for \`${existingBan.reason}\``,
						ephemeral: true,
					});
				}

				return this.#run(interaction, hypixelGuild, {
					command: `guild invite ${ign}`,
					responseRegExp: invite(ign),
				});
			}

			case 'list':
			case 'members':
			case 'online':
				return this.#runList(interaction, hypixelGuild, {
					command: `guild ${SUBCOMMAND}`,
				});

			case 'log': {
				const COMMAND = `log ${InteractionUtil.getIgn(interaction) ?? ''}`.trimEnd();

				return this.#runPaginated(
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

				return this.#run(interaction, hypixelGuild, {
					command: `guild member ${target}`,
					abortRegExp: unknownIgn(target.ign),
				});
			}

			case 'mute': {
				const DURATION_INPUT = interaction.options.getString('duration', true);
				const DURATION = stringToMS(DURATION_INPUT);

				if (Number.isNaN(DURATION)) {
					return InteractionUtil.reply(interaction, {
						content: `\`${DURATION_INPUT}\` is not a valid duration`,
						ephemeral: true,
					});
				}

				return this.runMuteInteraction(interaction, hypixelGuild, DURATION);
			}

			case 'promote': {
				const executor = UserUtil.getPlayer(interaction.user);

				if (!executor) {
					return InteractionUtil.reply(interaction, {
						content: 'unable to find a linked player for your discord account',
						ephemeral: true,
					});
				}
				if (!executor.isStaff) {
					return InteractionUtil.reply(interaction, {
						content: 'you need to have an in game staff rank for this command',
						ephemeral: true,
					});
				}

				const target = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });

				if (target.guildRankPriority >= executor.guildRankPriority - 1) {
					return InteractionUtil.reply(interaction, {
						content: 'you can only promote up to your own rank',
						ephemeral: true,
					});
				}

				return this.#run(interaction, hypixelGuild, {
					command: `guild promote ${target}`,
					responseRegExp: promote(target.ign),
				});
			}

			case 'setrank': {
				const executor = UserUtil.getPlayer(interaction.user);

				if (!executor) {
					return InteractionUtil.reply(interaction, {
						content: 'unable to find a linked player for your discord account',
						ephemeral: true,
					});
				}
				if (!executor.isStaff) {
					return InteractionUtil.reply(interaction, {
						content: 'you need to have an in game staff rank for this command',
						ephemeral: true,
					});
				}

				const target = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });
				const RANK_INPUT = interaction.options.getString('rank', true);
				const { value: rank, similarity } = autocorrect(RANK_INPUT, hypixelGuild.ranks, 'name');

				if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) {
					return InteractionUtil.reply(interaction, {
						content: `unknown guild rank '${RANK_INPUT}'`,
						ephemeral: true,
					});
				}

				if (target.guildRankPriority >= executor.guildRankPriority || rank.priority >= executor.guildRankPriority) {
					return InteractionUtil.reply(interaction, {
						content: 'you can only change ranks up to your own rank',
						ephemeral: true,
					});
				}

				return this.#run(interaction, hypixelGuild, {
					command: `guild setrank ${target} ${rank.name}`,
					responseRegExp: setRank(target.ign, undefined, rank.name),
				});
			}

			case 'unmute': {
				const TARGET_INPUT = interaction.options.getString('target', true).toLowerCase();

				let target;

				if (this.GUILD_IDENTIFIER.has(TARGET_INPUT as any)) {
					target = 'everyone';
				} else {
					target =
						InteractionUtil.getPlayer(interaction) ??
						(InteractionUtil.checkForce(interaction)
							? TARGET_INPUT // use input if force is set
							: await (() => {
									const queryParams: WhereOptions<Player['_attributes']>[] = [
										{
											ign: { [Op.iLike]: TARGET_INPUT },
											minecraftUuid: TARGET_INPUT,
										},
									];

									// check if input is a discord id or @mention
									const ID = getIdFromString(TARGET_INPUT);
									if (ID) queryParams.push({ discordId: ID });

									return this.client.players.fetch({
										[Op.or]: queryParams,
										cache: false,
									});
							  })());

					if (!target) {
						return InteractionUtil.reply(interaction, {
							content: `no player with the IGN \`${TARGET_INPUT}\` found`,
							ephemeral: true,
						});
					}
				}

				if (this.client.players.isModel(target)) {
					if (target.guildRankPriority >= (UserUtil.getPlayer(interaction.user)?.guildRankPriority ?? 0)) {
						return InteractionUtil.reply(interaction, {
							content: `your guild rank needs to be higher than \`${target}\`'s`,
							ephemeral: true,
						});
					}

					await target.update({ mutedTill: 0 });

					if (!target.inGuild()) return InteractionUtil.reply(interaction, `unmuted \`${target}\``);
				} else if (target === 'everyone') {
					await hypixelGuild.update({ mutedTill: 0 });
				}

				return this.#run(interaction, hypixelGuild, {
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
