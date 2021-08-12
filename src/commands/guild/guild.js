'use strict';

const { Interaction, SnowflakeUtil, Formatters, Constants } = require('discord.js');
const { Op } = require('sequelize');
const ms = require('ms');
const { demote, kick: { success: kickSuccess, error: kickError }, invite, mute, promote, setRank, unmute, historyErrors, logErrors, topErrors } = require('../../structures/chat_bridge/constants/commandResponses');
const { removeMcFormatting } = require('../../structures/chat_bridge/functions/util');
const { EMBED_DESCRIPTION_MAX_CHARS } = require('../../constants/discord');
const { GUILD_ID_BRIDGER, UNKNOWN_IGN } = require('../../constants/database');
const { stringToMS, trim, getIdFromString, autocorrect } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');
const UserUtil = require('../../util/UserUtil');


const commonOptions = new Map([ [
	'player',
	{
		name: 'player',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'IGN | UUID | discord ID | @mention',
		required: true,
	},
], [
	'player_optional',
	{
		name: 'player',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'IGN | UUID | discord ID | @mention',
		required: false,
	},
], [
	'ign',
	{
		name: 'ign',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'IGN',
		required: true,
	},
], [
	'page',
	{
		name: 'page',
		type: Constants.ApplicationCommandOptionTypes.INTEGER,
		description: 'page number',
		required: false,
	},
], [
	'rank',
	{
		name: 'rank',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'rank name',
		required: true,
	},
], [
	'target',
	{
		name: 'target',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'IGN | UUID | discord ID | @mention | \'guild\' | \'everyone\'',
		required: true,
	},
], [
	'duration',
	{
		name: 'duration',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 's[econds] | m[inutes] | h[ours] | d[ays]',
		required: true,
	},
], [
	'days_ago',
	{
		name: 'days_ago',
		type: Constants.ApplicationCommandOptionTypes.INTEGER,
		description: 'number of days ago',
		required: false,
	},
], [
	'reason',
	{
		name: 'reason',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'reason',
		required: true,
	},
] ]);


module.exports = class GuildCommand extends SlashCommand {
	constructor(data) {
		const guildOption = SlashCommand.guildOptionBuilder(data.client);

		const options = [{
			name: 'demote',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'demote',
			options: [ 'player' ],
		}, {
			name: 'kick',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'kick',
			options: [ 'player', 'reason' ],
		}, {
			name: 'history',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'history',
			options: [ 'page' ],
		}, {
			name: 'info',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'info',
			options: [],
		}, {
			name: 'invite',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'invite',
			options: [ 'ign' ],
		}, {
			name: 'list',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'list',
			options: [],
		}, {
			name: 'log',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'log',
			options: [ 'player_optional', 'page' ],
		}, {
			name: 'member',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'member',
			options: [ 'player_optional' ],
		}, {
			name: 'members',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'members',
			options: [],
		}, {
			name: 'motd',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'motd',
			options: [],
		}, {
			name: 'mute',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'mute',
			options: [ 'target', 'duration' ],
		}, {
			name: 'online',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'online',
			options: [],
		}, {
			name: 'promote',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'promote',
			options: [ 'player' ],
		}, {
			name: 'quest',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'quest',
			options: [],
		}, {
			name: 'setrank',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'setrank',
			options: [ 'player', 'rank' ],
		}, {
			name: 'top',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'top',
			options: [ 'days_ago' ],
		}, {
			name: 'unmute',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'unmute',
			options: [ 'target' ],
		}].map((option) => {
			const isPlayerCommand = option.options.includes('player') || option.options.includes('target');
			option.options = option.options.map(optionName => commonOptions.get(optionName));
			if (isPlayerCommand) option.options.push(SlashCommand.FORCE_OPTION);
			option.options.push(guildOption);
			return option;
		});

		super(data, {
			aliases: [ 'g' ],
			description: 'hypixel',
			options,
			cooldown: 0,
		});
	}

	/**
	 * /g mute
	 * @param {import('discord.js').CommandInteraction | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {{ targetInput: string, duration: number, hypixelGuildInput?: import('../../structures/database/models/HypixelGuild') }} param1
	 */
	async runMute(ctx, { targetInput, duration, hypixelGuildInput = this.getHypixelGuild(ctx) }) {
		const IS_INTERACTION = ctx instanceof Interaction;

		if (IS_INTERACTION) ctx.deferReply();

		let hypixelGuild = hypixelGuildInput;
		let target;

		if ([ 'guild', 'everyone' ].includes(targetInput)) {
			target = 'everyone';
		} else {
			target = IS_INTERACTION
				? this.getPlayer(ctx)
					?? (ctx.checkForce
						? targetInput // use input if force is set
						: (await this.client.players.fetch({ // try to find by ign or uuid
							[Op.or]: [{
								ign: { [Op.iLike]: targetInput },
								minecraftUuid: targetInput,
							}],
							cache: false,
						})
							?? await (async () => { // check if input is a discord id or @mention, find or create player db object if so
								const ID = getIdFromString(targetInput);

								if (!ID) return null;

								try {
									// check if ID is from a member in the guild
									await this.client.lgGuild?.members.fetch(ID);

									return (await this.client.players.model.findOrCreate({
										where: { discordId: ID },
										defaults: {
											minecraftUuid: SnowflakeUtil.generate(),
											guildId: GUILD_ID_BRIDGER,
											ign: UNKNOWN_IGN,
											inDiscord: true,
										},
									}))[0];
								} catch (error) {
									return logger.error(error);
								}
							})()
						)
					)
				: this.client.players.getByIgn(targetInput) ?? targetInput;

			if (!target) return ctx.reply({
				content: `no player with the IGN \`${targetInput}\` found`,
				ephemeral: true,
			});

			if (target instanceof this.client.players.model) {
				({ hypixelGuild } = target);
			}
		}

		if (target instanceof this.client.players.model) {
			if (target.guildRankPriority >= ((IS_INTERACTION ? UserUtil.getPlayer(ctx.user) : ctx.player)?.guildRankPriority ?? 0)) return ctx.reply({
				content: `your guild rank needs to be higher than ${target}'s`,
				ephemeral: true,
			});

			target.mutedTill = Date.now() + duration;
			await target.save();

			if (target.notInGuild) return ctx.reply(`muted \`${target}\` for \`${duration}\``);
		} else if (target === 'everyone') {
			hypixelGuild.mutedTill = Date.now() + duration;
			await hypixelGuild.save();
		}

		// interaction
		if (IS_INTERACTION) return this.#run(ctx, {
			command: `g mute ${target} ${ms(duration)}`,
			responseRegExp: mute(target === 'everyone' ? 'the guild chat' : `${target}`, hypixelGuild.chatBridge.bot.username),
		}, hypixelGuild);

		// hypixel message
		return ctx.author.send(await hypixelGuild.chatBridge.minecraft.command({
			command: `g mute ${target} ${ms(duration)}`,
			responseRegExp: mute(target === 'everyone' ? 'the guild chat' : `${target}`, hypixelGuild.chatBridge.bot.username),
		}));
	}

	/**
	 * @param {{ interaction: ?import('discord.js').CommandInteraction, target: import('../../structures/database/models/Player') | string, executor: ?import('../../structures/database/models/Player'), hypixelGuild: import('../../structures/database/models/HypixelGuild'), reason: string }} param0
	 * @returns {Promise<{ content: string, ephemeral: boolean }>}
	 */
	async runKick({ interaction, target, executor, hypixelGuild, reason }) {
		if (!executor) return {
			content: 'unable to find a linked player to your discord account',
			ephemeral: true,
		};
		if (!executor.isStaff) return {
			content: 'you need to have an in game staff rank for this command',
			ephemeral: true,
		};
		if (executor.guildId !== hypixelGuild.guildId) return {
			content: `you need to be in ${hypixelGuild.name} to kick a player from there`,
			ephemeral: true,
		};

		if (typeof target === 'string') return {
			content: `no player with the IGN \`${target}\` found`,
			ephemeral: true,
		};
		if (target.guildRankPriority >= executor.guildRankPriority) return {
			content: `your guild rank needs to be higher than ${target}'s`,
			ephemeral: true,
		};

		const TIME_LEFT = this.config.get('LAST_KICK_TIME') + this.config.get('KICK_COOLDOWN') - Date.now();

		if (TIME_LEFT > 0) return {
			content: `kicking is on cooldown for another ${ms(TIME_LEFT, { long: true })}`,
			ephemeral: true,
		};

		try {
			const { chatBridge } = hypixelGuild;

			interaction?.deferReply();

			const res = await chatBridge.minecraft.command({
				command: `g kick ${target} ${reason}`,
				responseRegExp: kickSuccess(target.ign, chatBridge.bot.username),
				abortRegExp: kickError(target.ign),
				rejectOnAbort: true,
				timeout: 60_000,
				rejectOnTimeout: true,
			});

			this.config.set('LAST_KICK_TIME', Date.now());

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
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 * @param {import('../../structures/chat_bridge/managers/MinecraftChatManager').CommandOptions} commandOptions
	 * @param {?import('../../structures/database/models/HypixelGuild')} [hypixelGuild]
	 */
	async #run(interaction, commandOptions, { chatBridge } = this.getHypixelGuild(interaction)) {
		this.deferReply(interaction);

		return await this.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${commandOptions.command}`)
					.setDescription(Formatters.codeBlock(await chatBridge.minecraft.command(commandOptions))),
			],
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 * @param {import('../../structures/chat_bridge/managers/MinecraftChatManager').CommandOptions} commandOptions
	 */
	async #runList(interaction, commandOptions) {
		const { chatBridge } = this.getHypixelGuild(interaction);

		this.deferReply(interaction);

		return await this.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${commandOptions.command}`)
					.setDescription(Formatters.codeBlock(
						trim(
							(await chatBridge.minecraft.command({
								raw: true,
								...commandOptions,
							}))
								.map(msg => (msg.content.includes('●')
									? removeMcFormatting(
										msg.formattedContent
											.replace(/§r§c ●/g, ' 🔴') // prettify emojis
											.replace(/§r§a ●/g, ' 🟢')
											.replace(/\[.+?\] /g, ''), // remove hypixel ranks (helps with staying inside the character limit)
									)
									: msg.content),
								)
								.join('\n'),
							EMBED_DESCRIPTION_MAX_CHARS - 8, // 2 * (3 [```] + 1 [\n])
						),
					)),
			],
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		const SUB_COMMAND = interaction.options.getSubcommand();

		switch (SUB_COMMAND) {
			case 'demote': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const executor = UserUtil.getPlayer(interaction.user);

				if (!executor) return await this.reply(interaction, {
					content: 'unable to find a linked player for your discord account',
					ephemeral: true,
				});
				if (!executor.isStaff) return await this.reply(interaction, {
					content: 'you need to have an in game staff rank for this command',
					ephemeral: true,
				});

				const target = this.getPlayer(interaction);

				if (!target) return await this.reply(interaction, {
					content: `no player with the IGN \`${interaction.options.getString('player', true)}\` found`,
					ephemeral: true,
				});

				if (target.guildRankPriority >= executor.guildRankPriority) return await this.reply(interaction, {
					content: `your guild rank needs to be higher than ${target}'s`,
					ephemeral: true,
				});

				return this.#run(interaction, {
					command: `g demote ${target}`,
					responseRegExp: demote(target.ign),
				});
			}

			case 'kick': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const target = this.getPlayer(interaction) ?? interaction.options.getString('player', true);
				const reason = interaction.options.getString('reason', true);
				const { content, ephemeral } = await this.runKick({
					interaction,
					target,
					executor: UserUtil.getPlayer(interaction.user),
					reason,
					hypixelGuild: target?.hypixelGuild ?? this.getHypixelGuild(interaction),
				});

				return await this.reply(interaction, {
					embeds: [
						this.client.defaultEmbed
							.setTitle(`/g kick ${target} ${reason}`)
							.setDescription(Formatters.codeBlock(content)),
					],
					ephemeral: interaction.options.get('visibility') === null
						? interaction.useEphemeral || ephemeral
						: interaction.useEphemeral,
				});
			}

			case 'history': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this.#run(interaction, {
					command: `g history ${interaction.options.getInteger('page') ?? ''}`,
					abortRegExp: historyErrors(),
				});
			}

			case 'info':
			case 'motd':
			case 'quest': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this.#run(interaction, {
					command: `g ${SUB_COMMAND}`,
				});
			}

			case 'top': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this.#run(interaction, {
					command: `g top ${interaction.options.getInteger('days_ago') ?? ''}`,
					abortRegExp: topErrors(),
				});
			}

			case 'invite': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = interaction.options.getString('ign', true);

				return this.#run(interaction, {
					command: `g invite ${IGN}`,
					responseRegExp: invite(IGN),
				});
			}

			case 'list':
			case 'members':
			case 'online': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('BRIDGER_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this.#runList(interaction, {
					command: `g ${SUB_COMMAND}`,
				});
			}

			case 'log': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIgn(interaction);
				const PAGE = interaction.options.getInteger('page');

				return this.#run(interaction, {
					command: `g log ${[ IGN, PAGE ].filter(x => x != null).join(' ')}`,
					abortRegExp: logErrors(),
				});
			}

			case 'member': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIgn(interaction, true);
				if (!IGN) return await this.reply(interaction, {
					content: 'you are not in the player db',
					ephemeral: true,
				});

				return this.#run(interaction, {
					command: `g member ${IGN}`,
				});
			}

			case 'mute': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const DURATION_INPUT = interaction.options.getString('duration', true);
				const DURATION = stringToMS(DURATION_INPUT);

				if (Number.isNaN(DURATION)) return await this.reply(interaction, {
					content: `\`${DURATION_INPUT}\` is not a valid duration`,
					ephemeral: true,
				});

				return this.runMute(interaction, {
					targetInput: interaction.options.getString('target', true).toLowerCase(),
					duration: DURATION,
				});
			}

			case 'promote': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const executor = UserUtil.getPlayer(interaction.user);

				if (!executor) return await this.reply(interaction, {
					content: 'unable to find a linked player for your discord account',
					ephemeral: true,
				});
				if (!executor.isStaff) return await this.reply(interaction, {
					content: 'you need to have an in game staff rank for this command',
					ephemeral: true,
				});

				const target = this.getPlayer(interaction);

				if (!target) return await this.reply(interaction, {
					content: `no player with the IGN \`${interaction.options.getString('player', true)}\` found`,
					ephemeral: true,
				});

				if (target.guildRankPriority >= executor.guildRankPriority - 1) return await this.reply(interaction, {
					content: 'you can only promote up to your own rank',
					ephemeral: true,
				});

				return this.#run(interaction, {
					command: `g promote ${target}`,
					responseRegExp: promote(target.ign),
				});
			}

			case 'setrank': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const executor = UserUtil.getPlayer(interaction.user);

				if (!executor) return await this.reply(interaction, {
					content: 'unable to find a linked player for your discord account',
					ephemeral: true,
				});
				if (!executor.isStaff) return await this.reply(interaction, {
					content: 'you need to have an in game staff rank for this command',
					ephemeral: true,
				});

				const target = this.getPlayer(interaction);

				if (!target) return await this.reply(interaction, {
					content: `no player with the IGN \`${interaction.options.getString('player', true)}\` found`,
					ephemeral: true,
				});

				const hypixelGuild = this.getHypixelGuild(interaction);
				const RANK_INPUT = interaction.options.getString('rank', true);
				const { value: rank, similarity } = autocorrect(RANK_INPUT, hypixelGuild.ranks, 'name');

				if (similarity < this.config.get('AUTOCORRECT_THRESHOLD')) return `unknown guild rank '${RANK_INPUT}'`;

				if (target.guildRankPriority >= executor.guildRankPriority || rank.priority >= executor.guildRankPriority) return await this.reply(interaction, {
					content: 'you can only change ranks up to your own rank',
					ephemeral: true,
				});

				return this.#run(interaction, {
					command: `g setrank ${target} ${rank.name}`,
					responseRegExp: setRank(target.ign, undefined, rank.name),
				});
			}

			case 'unmute': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const TARGET_INPUT = interaction.options.getString('target', true).toLowerCase();

				let hypixelGuild = this.getHypixelGuild(interaction);
				let target;

				if ([ 'guild', 'everyone' ].includes(TARGET_INPUT)) {
					target = 'everyone';
				} else {
					target = this.getPlayer(interaction)
							?? (interaction.checkForce
								? TARGET_INPUT // use input if force is set
								: await (async () => {
									const queryParams = [{
										ign: { [Op.iLike]: TARGET_INPUT },
										minecraftUuid: TARGET_INPUT,
									}];

									// check if input is a discord id or @mention
									const ID = getIdFromString(TARGET_INPUT);
									if (ID) queryParams.push({ discordId: ID });

									return this.client.players.fetch({
										[Op.or]: queryParams,
										cache: false,
									});
								})()
							);

					if (!target) return await this.reply(interaction, {
						content: `no player with the IGN \`${TARGET_INPUT}\` found`,
						ephemeral: true,
					});

					if (target instanceof this.client.players.model) {
						({ hypixelGuild } = target);
					}
				}

				if (target instanceof this.client.players.model) {
					if (target.guildRankPriority >= (UserUtil.getPlayer(interaction.user)?.guildRankPriority ?? 0)) return await this.reply(interaction, {
						content: `your guild rank needs to be higher than ${target}'s`,
						ephemeral: true,
					});

					target.mutedTill = 0;
					await target.save();

					if (target.notInGuild) return await this.reply(interaction, `unmuted \`${target}\``);
				} else if (target === 'everyone') {
					hypixelGuild.mutedTill = 0;
					await hypixelGuild.save();
				}

				return this.#run(interaction, {
					command: `g unmute ${target}`,
					responseRegExp: unmute(target === 'everyone' ? 'the guild chat' : `${target}`, hypixelGuild.chatBridge.bot.username),
				}, hypixelGuild);
			}

			default:
				throw new Error(`unknown subcommand '${SUB_COMMAND}'`);
		}
	}
};
