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
} = require('../../structures/chat_bridge/constants/commandResponses');
const { removeMcFormatting } = require('../../structures/chat_bridge/functions/util');
const { EMBED_DESCRIPTION_MAX_CHARS } = require('../../constants/discord');
const { stringToMS, trim } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../functions/logger');


const commonOptions = new Map([ [
	'player',
	{
		name: 'player',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'IGN | minecraftUUID | discordID | @mention',
		required: true,
	},
], [
	'player_optional',
	{
		name: 'player',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'IGN | minecraftUUID | discordID | @mention',
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
		description: 'player: IGN | minecraftUUID | discordID | @mention\nguild: \'guild\' | \'everyone\'',
		required: true,
	},
], [
	'duration',
	{
		name: 'duration',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'number of s[econds] | m[inutes] | h[ours] | d[ays]',
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
] ]);


module.exports = class SetRankCommand extends SlashCommand {
	/**
	 * @param {import('../../structures/commands/SlashCommand').CommandData} commandData
	 */
	constructor(data, commandData) {
		const options = [{
			name: 'demote',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'demote a player',
			options: [ 'player' ],
		}, {
			name: 'history',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild history',
			options: [ 'page' ],
		}, {
			name: 'info',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild info',
			options: [],
		}, {
			name: 'invite',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'invite a player',
			options: [ 'ign' ],
		}, {
			name: 'list',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild list',
			options: [],
		}, {
			name: 'log',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild log',
			options: [ 'player_optional', 'page' ],
		}, {
			name: 'member',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild member',
			options: [ 'player_optional' ],
		}, {
			name: 'members',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild members',
			options: [],
		}, {
			name: 'motd',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild motd',
			options: [],
		}, {
			name: 'mute',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'mute a player',
			options: [ 'target', 'duration' ],
		}, {
			name: 'online',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild online',
			options: [],
		}, {
			name: 'promote',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'promote a player',
			options: [ 'player' ],
		}, {
			name: 'quest',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild quest',
			options: [],
		}, {
			name: 'setrank',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'sets the rank of a player',
			options: [ 'player', 'rank' ],
		}, {
			name: 'top',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'guild top',
			options: [ 'days_ago' ],
		}, {
			name: 'unmute',
			type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
			description: 'unmute a player',
			options: [ 'target' ],
		}].map((option) => {
			const isPlayerCommand = option.options.includes('player') || option.options.includes('target');
			option.options = option.options.map(optionName => commonOptions.get(optionName));
			if (isPlayerCommand) option.options.push(SlashCommand.FORCE_OPTION);
			option.options.push(SlashCommand.GUILD_OPTION);
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
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 * @param {import('../../structures/chat_bridge/managers/MinecraftChatManager').CommandOptions} commandOptions
	 * @param {?import('../../structures/database/models/HypixelGuild')} [hypixelGuildOverwrite]
	 */
	async _run(interaction, options, commandOptions, hypixelGuildOverwrite) {
		const hypixelGuildInput = options?.find(({ name }) => name === 'guild')?.value;
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = hypixelGuildOverwrite ?? (hypixelGuildInput
			? (() => {
				const { value, similarity } = this.client.hypixelGuilds.autocorrectToGuild(hypixelGuildInput);

				if (similarity <= this.config.get('AUTOCORRECT_THRESHOLD')) return null;

				return value;
			})()
			: interaction.user.player?.guild);

		if (!hypixelGuild) return interaction.reply({
			content: `unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`,
			ephemeral: true,
		});

		return interaction.reply({
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/${commandOptions.command}`)
					.setDescription(`\`\`\`\n${await hypixelGuild.chatBridge.minecraft.command(commandOptions)}\`\`\``),
			],
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 * @param {import('../../structures/chat_bridge/managers/MinecraftChatManager').CommandOptions} commandOptions
	 */
	async _runList(interaction, options, commandOptions) {
		const hypixelGuildInput = options?.find(({ name }) => name === 'guild')?.value;
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = hypixelGuildInput
			? (() => {
				const { value, similarity } = this.client.hypixelGuilds.autocorrectToGuild(hypixelGuildInput);

				if (similarity <= this.config.get('AUTOCORRECT_THRESHOLD')) return null;

				return value;
			})()
			: interaction.user.player?.guild;

		if (!hypixelGuild) return interaction.reply({
			content: `unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`,
			ephemeral: true,
		});

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
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer();

		// destructure sub command
		const { name, options } = interaction.options.first();

		switch (name) {
			case 'demote': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIGN(options);

				return this._run(interaction, options, {
					command: `g demote ${IGN}`,
					responseRegExp: demote(IGN),
				});
			}

			case 'history': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this._run(interaction, options, {
					command: `g history ${options?.get('page')?.value ?? ''}`,
					abortRegExp: historyErrors(),
				});
			}

			case 'info':
			case 'motd':
			case 'quest': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this._run(interaction, options, {
					command: `g ${name}`,
				});
			}

			case 'top': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this._run(interaction, options, {
					command: `g top ${options?.get('days_ago')?.value ?? ''}`,
					abortRegExp: topErrors(),
				});
			}

			case 'invite': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIGN(options);

				return this._run(interaction, options, {
					command: `g invite ${IGN}`,
					responseRegExp: invite(IGN),
				});
			}

			case 'list':
			case 'members':
			case 'online': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('BRIDGER_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this._runList(interaction, options, {
					command: `g ${name}`,
				});
			}

			case 'log': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIGN(options);
				const PAGE = options?.get('page')?.value;

				return this._run(interaction, options, {
					command: `g log ${[ IGN, PAGE ].filter(Boolean).join(' ')}`,
					abortRegExp: logErrors(),
				});
			}

			case 'member': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIGN(options) ?? interaction.user.player?.ign;
				if (!IGN) return interaction.reply({
					content: 'you are not in the player db',
					ephemeral: true,
				});

				return this._run(interaction, options, {
					command: `g member ${IGN}`,
				});
			}

			case 'mute': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const { players } = this.client;
				const TARGET_INPUT = options.get('target').value;
				const DURATION_INPUT = options.get('duration').value;
				const hypixelGuildInput = options.get('guild')?.value;

				/**
				 * @type {import('../../structures/database/models/HypixelGuild')}
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

					if (!hypixelGuild) return interaction.reply({
						content: `unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`,
						ephemeral: true,
					});
				} else {
					target = this.getPlayer(TARGET_INPUT, options);

					if (!target) return interaction.reply({
						content: `no player with the IGN \`${TARGET_INPUT}\` found`,
						ephemeral: true,
					});

					if (target instanceof players.model) {
						({ guild: hypixelGuild } = target);

						if (!hypixelGuild) return interaction.reply({
							content: `unable to find the guild for \`${target.ign}\``,
							ephemeral: true,
						});
					} else {
						hypixelGuild ??= interaction.user.hypixelGuild;

						if (!hypixelGuild) return interaction.reply({
							content: `unable to find ${hypixelGuildInput ? `a guild with the name \`${hypixelGuildInput}\`` : 'your guild'}`,
							ephemeral: true,
						});
					}
				}

				const DURATION = stringToMS(DURATION_INPUT);

				if (Number.isNaN(DURATION)) return interaction.reply({
					content: `\`${DURATION_INPUT}\` is not a valid duration`,
					ephemeral: true,
				});

				const EXPIRES_AT = Date.now() + DURATION;

				if (target instanceof players.model) {
					target.mutedTill = EXPIRES_AT;
					await target.save();

					if (target.notInGuild) return interaction.reply(`muted \`${target}\` for \`${DURATION_INPUT}\``);
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
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIGN(options);

				return this._run(interaction, options, {
					command: `g promote ${IGN}`,
					responseRegExp: promote(IGN),
				});
			}

			case 'setrank': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIGN(options);
				const RANK = options.get('rank').value;

				return this._run(interaction, options, {
					command: `g setrank ${IGN} ${RANK}`,
					responseRegExp: setRank(IGN, undefined, RANK),
				});
			}

			case 'unmute': {
				await this.checkPermissions(interaction, {
					roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const { players } = this.client;
				const TARGET_INPUT = options.get('target').value;
				const HYPIXEL_GUILD_INPUT = options.get('guild')?.value;

				/**
				 * @type {import('../../structures/database/models/HypixelGuild')}
				 */
				let hypixelGuild = HYPIXEL_GUILD_INPUT
					? (() => {
						const { value, similarity } = this.client.hypixelGuilds.autocorrectToGuild(HYPIXEL_GUILD_INPUT);

						if (similarity <= this.config.get('AUTOCORRECT_THRESHOLD')) return null;

						return value;
					})()
					: null;
				let target;

				if ([ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
					target = 'everyone';
					hypixelGuild ??= interaction.user.hypixelGuild;

					if (!hypixelGuild) return interaction.reply({
						content: `unable to find ${HYPIXEL_GUILD_INPUT ? `a guild with the name \`${HYPIXEL_GUILD_INPUT}\`` : 'your guild'}`,
						ephemeral: true,
					});
				} else {
					target = this.getPlayer(TARGET_INPUT, options);

					if (!target) return interaction.reply({
						content: `no player with the IGN \`${TARGET_INPUT}\` found`,
						ephemeral: true,
					});

					if (target instanceof players.model) {
						({ guild: hypixelGuild } = target);

						if (!hypixelGuild) return interaction.reply({
							content: `unable to find the guild for \`${target.ign}\``,
							ephemeral: true,
						});
					} else {
						hypixelGuild ??= interaction.user.hypixelGuild;

						if (!hypixelGuild) return interaction.reply({
							content: `unable to find ${HYPIXEL_GUILD_INPUT ? `a guild with the name \`${HYPIXEL_GUILD_INPUT}\`` : 'your guild'}`,
							ephemeral: true,
						});
					}
				}

				if (target instanceof players.model) {
					target.mutedTill = 0;
					await target.save();

					if (target.notInGuild) return interaction.reply(`unmuted \`${target}\``);
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
