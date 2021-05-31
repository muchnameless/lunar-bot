'use strict';

const { Constants } = require('discord.js');
const {
	demote: { regExp: demote },
	invite: { regExp: invite },
	mute: { regExp: mute },
	promote: { regExp: promote },
	setRank: { regExp: setRank },
	unmute: { regExp: unmute },
	historyErrors: { regExp: historyErrors },
	logErrors: { regExp: logErrors },
	topErrors: { regExp: topErrors },
} = require('../structures/chat_bridge/constants/commandResponses');
const { removeMcFormatting } = require('../structures/chat_bridge/functions/util');
const { EMBED_DESCRIPTION_MAX_CHARS } = require('../constants/discord');
const { getIDFromString, stringToMS, trim } = require('../functions/util');
const SlashCommand = require('../structures/commands/SlashCommand');
const MissingPermissionsError = require('../structures/errors/MissingPermissionsError');
const logger = require('../functions/logger');

const guildOption = {
	name: 'guild',
	type: Constants.ApplicationCommandOptionTypes.STRING,
	description: 'hypixel guild',
	required: false,
};
const forceOption = {
	name: 'force',
	type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
	description: 'disable IGN autocorrection',
	required: false,
};


module.exports = class SetRankCommand extends SlashCommand {
	/**
	 * @param {import('../structures/commands/SlashCommand').CommandData} commandData
	 */
	constructor(data, commandData) {
		const options = [
			{
				name: 'demote',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'demote a player',
				options: [
					{
						name: 'ign',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'player to demote',
						required: true,
					},
				],
			},
			{
				name: 'history',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild history',
				options: [
					{
						name: 'page',
						type: 'INTEGER',
						description: 'log page',
						required: false,
					},
				],
			},
			{
				name: 'info',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild info',
				options: [],
			},
			{
				name: 'invite',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'invite a player',
				options: [
					{
						name: 'ign',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'IGN of the player to invite',
						required: true,
					},
				],
			},
			{
				name: 'list',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild list',
				options: [],
			},
			{
				name: 'log',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild log',
				options: [
					{
						name: 'ign',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'player to filter the logs by',
						required: false,
					},
					{
						name: 'page',
						type: 'INTEGER',
						description: 'log page',
						required: false,
					},
				],
			},
			{
				name: 'member',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild member',
				options: [
					{
						name: 'ign',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'player to get the info from',
						required: false,
					},
				],
			},
			{
				name: 'members',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild members',
				options: [],
			},
			{
				name: 'motd',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild motd',
				options: [],
			},
			{
				name: 'mute',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'mute a player',
				options: [
					{
						name: 'target',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'player ign, \'guild\' or \'everyone\'',
						required: true,
					},
					{
						name: 'duration',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'duration to mute for',
						required: true,
					},
				],
			},
			{
				name: 'online',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild online',
				options: [],
			},
			{
				name: 'promote',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'promote a player',
				options: [
					{
						name: 'ign',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'player to promote',
						required: true,
					},
				],
			},
			{
				name: 'quest',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild quest',
				options: [],
			},
			{
				name: 'setrank',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'sets the rank of a player',
				options: [
					{
						name: 'ign',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'player to set the rank of',
						required: true,
					},
					{
						name: 'rank',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'new rank for the player',
						required: true,
					},
				],
			},
			{
				name: 'top',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'guild top',
				options: [
					{
						name: 'days_ago',
						type: 'INTEGER',
						description: 'obtain data from x days ago',
						required: false,
					},
				],
			},
			{
				name: 'unmute',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'unmute a player',
				options: [
					{
						name: 'target',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'player ign, \'guild\' or \'everyone\'',
						required: true,
					},
				],
			},
		].map((option) => {
			if (option.options.some(({ name }) => name === 'ign' || name === 'target')) option.options.push(forceOption);
			option.options.push(guildOption);
			return option;
		});

		super(data, commandData ?? {
			aliases: [ 'g' ],
			description: 'hypixel guild command',
			options,
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * returns the player object
	 * @param {string} ignOrMention
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 * @returns {import('../structures/database/models/Player')}
	 */
	getPlayer(ignOrMention, options) {
		const id = getIDFromString(ignOrMention);

		return id
			? this.client.players.getByID(id)
			: (SlashCommand.checkForce(options)
				? this.client.players.findByIGN(ignOrMention)
				: (this.client.players.getByID(ignOrMention) ?? this.client.players.getByIGN(ignOrMention))
			) ?? ignOrMention;
	}

	/**
	 * returns the player object
	 * @param {string} ignOrMention
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 * @returns {string}
	 */
	getIGN(ignOrMention, options) {
		const id = getIDFromString(ignOrMention);

		return id
			? this.client.players.getByID(id)?.ign
			: (SlashCommand.checkForce(options)
				? ignOrMention
				: (this.client.players.getByID(ignOrMention)?.ign ?? this.client.players.getByIGN(ignOrMention)?.ign ?? ignOrMention)
			);
	}

	/**
	 * @param {import('../structures/extensions/CommandInteraction')} interaction
	 * @param {{ userIDs: string[], roleIDs: string[] }} permissions
	 */
	async checkPermissions(interaction, { userIDs = [ this.client.ownerID ], roleIDs = [] }) {
		if (!userIDs.length && !roleIDs.length) return;
		if (userIDs.includes(interaction.user.id)) return;

		const member = interaction.guildID === this.config.get('MAIN_GUILD_ID')
			? interaction.member
			: await (async () => {
				const { lgGuild } = this.client;

				if (!lgGuild) {
					throw new MissingPermissionsError('discord server unreachable', { interaction, requiredRoles: roleIDs });
				}

				try {
					return await lgGuild.members.fetch(interaction.user.id);
				} catch (error) {
					logger.error('[CHECK PERMISSIONS]: error while fetching member to test for permissions', error);
					throw new MissingPermissionsError('unknown discord member', { interaction, requiredRoles: roleIDs });
				}
			})();

		// check for req roles
		if (!member.roles.cache.some((_, roleID) => roleIDs.includes(roleID))) {
			throw new MissingPermissionsError('missing required role', { interaction, requiredRoles: roleIDs });
		}
	}

	/**
	 * execute the command
	 * @param {import('../structures/extensions/CommandInteraction')} interaction
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 * @param {import('../structures/chat_bridge/managers/MinecraftChatManager').CommandOptions} commandOptions
	 * @param {?import('../structures/database/models/HypixelGuild')} [hypixelGuildOverwrite]
	 */
	async _run(interaction, options, commandOptions, hypixelGuildOverwrite) {
		const hypixelGuildInput = options?.find(({ name }) => name === 'guild')?.value;
		/**
		 * @type {import('../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = hypixelGuildOverwrite ?? (hypixelGuildInput
			? (() => {
				const { value, similarity } = this.client.hypixelGuilds.autocorrectToGuild(hypixelGuildInput);

				if (similarity <= this.config.get('AUTOCORRECT_THRESHOLD')) return null;

				return value;
			})()
			: interaction.user.player?.guild);

		if (!hypixelGuild) return interaction.reply(`unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`, { ephemeral: true });

		return interaction.reply({
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${commandOptions.command}`)
					.setDescription(`\`\`\`\n${await hypixelGuild.chatBridge.minecraft.command(commandOptions)}\`\`\``),
			],
			ephemeral: false,
		});
	}

	/**
	 * execute the command
	 * @param {import('../structures/extensions/CommandInteraction')} interaction
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 * @param {import('../structures/chat_bridge/managers/MinecraftChatManager').CommandOptions} commandOptions
	 */
	async _runList(interaction, options, commandOptions) {
		const hypixelGuildInput = options?.find(({ name }) => name === 'guild')?.value;
		/**
		 * @type {import('../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = hypixelGuildInput
			? (() => {
				const { value, similarity } = this.client.hypixelGuilds.autocorrectToGuild(hypixelGuildInput);

				if (similarity <= this.config.get('AUTOCORRECT_THRESHOLD')) return null;

				return value;
			})()
			: interaction.user.player?.guild;

		if (!hypixelGuild) return interaction.reply(`unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`, { ephemeral: true });

		return interaction.reply({
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${commandOptions.command}`)
					.setDescription(
						`\`\`\`${
							trim(
								(await hypixelGuild.chatBridge.minecraft.command({
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
							)
						}\`\`\``,
					),
			],
			ephemeral: false,
		});
	}

	/**
	 * execute the command
	 * @param {import('../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer();

		const [{ name, options }] = interaction.options;

		switch (name) {
			case 'demote': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const [{ value: IGN_INPUT }] = options;
				const IGN = this.getIGN(IGN_INPUT, options);

				return this._run(interaction, options, {
					command: `g demote ${IGN}`,
					responseRegExp: demote(IGN),
				});
			}

			case 'history': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const PAGE = options?.find(({ name: arg }) => arg === 'page')?.value;

				return this._run(interaction, options, {
					command: `g history ${PAGE ?? ''}`,
					abortRegExp: historyErrors(),
				});
			}

			case 'info':
			case 'motd':
			case 'quest': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				return this._run(interaction, options, {
					command: `g ${name}`,
				});
			}

			case 'top': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const DAYS_AGO = options?.find(({ name: arg }) => arg === 'days_ago')?.value;

				return this._run(interaction, options, {
					command: `g top ${DAYS_AGO ?? ''}`,
					abortRegExp: topErrors(),
				});
			}

			case 'invite': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const [{ value: IGN }] = options;

				return this._run(interaction, options, {
					command: `g invite ${IGN}`,
					responseRegExp: invite(IGN),
				});
			}

			case 'list':
			case 'members':
			case 'online': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('BRIDGER_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				return this._runList(interaction, options, {
					command: `g ${name}`,
				});
			}

			case 'log': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const IGN_INPUT = options?.find(({ name: arg }) => arg === 'ign')?.value;
				const IGN = IGN_INPUT && this.getIGN(IGN_INPUT, options);
				const PAGE = options?.find(({ name: arg }) => arg === 'page')?.value;

				return this._run(interaction, options, {
					command: `g log ${[ IGN, PAGE ].filter(Boolean).join(' ')}`,
					abortRegExp: logErrors(),
				});
			}

			case 'member': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const IGN_INPUT = options?.find(({ name: arg }) => arg === 'ign')?.value;
				const IGN = IGN_INPUT
					? this.getIGN(IGN_INPUT, options)
					: interaction.user.player?.ign;

				if (!IGN) return interaction.reply(`${IGN_INPUT ? `\`${IGN_INPUT}\` is` : 'you are'} not in the player db`, { ephemeral: true });

				return this._run(interaction, options, {
					command: `g member ${IGN}`,
				});
			}

			case 'mute': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const { players } = this.client;
				const [{ value: TARGET_INPUT }, { value: DURATION_INPUT }] = options;
				const hypixelGuildInput = options.find(({ name: arg }) => arg === 'guild')?.value;

				/**
				 * @type {import('../structures/database/models/HypixelGuild')}
				 */
				let hypixelGuild = hypixelGuildInput
					? (() => {
						const { value, similarity } = this.client.hypixelGuilds.autocorrectToGuild(hypixelGuildInput);

						if (similarity <= this.config.get('AUTOCORRECT_THRESHOLD')) return null;

						return value;
					})()
					: null;
				let target;

				if ([ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
					target = 'everyone';
					hypixelGuild ??= interaction.user.hypixelGuild;

					if (!hypixelGuild) return interaction.reply(`unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`, { ephemeral: true });
				} else {
					target = this.getPlayer(TARGET_INPUT, options);

					if (!target) return interaction.reply(`no player with the IGN \`${TARGET_INPUT}\` found`, { ephemeral: true });

					if (target instanceof players.model) {
						({ guild: hypixelGuild } = target);

						if (!hypixelGuild) return interaction.reply(`unable to find the guild for \`${target.ign}\``, { ephemeral: true });
					} else {
						hypixelGuild ??= interaction.user.hypixelGuild;

						if (!hypixelGuild) return interaction.reply(`unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`, { ephemeral: true });
					}
				}

				const DURATION = stringToMS(DURATION_INPUT);

				if (Number.isNaN(DURATION)) return interaction.reply(`\`${DURATION_INPUT}\` is not a valid duration`, { ephemeral: true });

				const EXPIRES_AT = Date.now() + DURATION;

				if (target instanceof players.model) {
					target.mutedTill = EXPIRES_AT;
					await target.save();

					if (target.notInGuild) return interaction.reply(`muted \`${target}\` for \`${DURATION_INPUT}\``, { ephemeral: false });
				} else if (target === 'everyone') {
					hypixelGuild.mutedTill = EXPIRES_AT;
					await hypixelGuild.save();
				}

				return this._run(interaction, options, {
					command: `g mute ${target} ${DURATION_INPUT}`,
					responseRegExp: mute(target === 'everyone' ? 'the guild chat' : target.toString(), hypixelGuild.chatBridge.bot.ign),
				}, hypixelGuild);
			}

			case 'promote': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const [{ value: IGN_INPUT }] = options;
				const IGN = this.getIGN(IGN_INPUT, options);

				return this._run(interaction, options, {
					command: `g promote ${IGN}`,
					responseRegExp: promote(IGN),
				});
			}

			case 'setrank': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const [{ value: IGN_INPUT }, { value: RANK }] = options;
				const IGN = this.getIGN(IGN_INPUT, options);

				return this._run(interaction, options, {
					command: `g setrank ${IGN} ${RANK}`,
					responseRegExp: setRank(IGN, undefined, RANK),
				});
			}

			case 'unmute': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const { players } = this.client;
				const [{ value: TARGET_INPUT }] = options;
				const hypixelGuildInput = options.find(({ name: arg }) => arg === 'guild')?.value;

				/**
				 * @type {import('../structures/database/models/HypixelGuild')}
				 */
				let hypixelGuild = hypixelGuildInput
					? (() => {
						const { value, similarity } = this.client.hypixelGuilds.autocorrectToGuild(hypixelGuildInput);

						if (similarity <= this.config.get('AUTOCORRECT_THRESHOLD')) return null;

						return value;
					})()
					: null;
				let target;

				if ([ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
					target = 'everyone';
					hypixelGuild ??= interaction.user.hypixelGuild;

					if (!hypixelGuild) return interaction.reply(`unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`, { ephemeral: true });
				} else {
					target = this.getPlayer(TARGET_INPUT, options);

					if (!target) return interaction.reply(`no player with the IGN \`${TARGET_INPUT}\` found`, { ephemeral: true });

					if (target instanceof players.model) {
						({ guild: hypixelGuild } = target);

						if (!hypixelGuild) return interaction.reply(`unable to find the guild for \`${target.ign}\``, { ephemeral: true });
					} else {
						hypixelGuild ??= interaction.user.hypixelGuild;

						if (!hypixelGuild) return interaction.reply(`unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`, { ephemeral: true });
					}
				}

				if (target instanceof players.model) {
					target.mutedTill = 0;
					await target.save();

					if (target.notInGuild) return interaction.reply(`unmuted \`${target}\``, { ephemeral: false });
				} else if (target === 'everyone') {
					hypixelGuild.mutedTill = 0;
					await hypixelGuild.save();
				}

				return this._run(interaction, options, {
					command: `g unmute ${target}`,
					responseRegExp: unmute(target === 'everyone' ? 'the guild chat' : `${target}`, hypixelGuild.chatBridge.bot.ign),
				}, hypixelGuild);
			}

			default:
				throw new Error('unknown command');
		}
	}
};
