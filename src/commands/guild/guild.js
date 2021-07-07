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
// const logger = require('../../functions/logger');


const commonOptions = new Map([ [
	'player',
	{
		name: 'player',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'IGN | uuid | discordID | @mention',
		required: true,
	},
], [
	'player_optional',
	{
		name: 'player',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'IGN | uuid | discordID | @mention',
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
		description: 'IGN | uuid | discordID | @mention | \'guild\' | \'everyone\'',
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
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 * @param {import('../../structures/chat_bridge/managers/MinecraftChatManager').CommandOptions} commandOptions
	 * @param {?import('../../structures/database/models/HypixelGuild')} [hypixelGuild]
	 */
	async _run(interaction, commandOptions, hypixelGuild = this.getHypixelGuild(interaction)) {
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
	 * @param {import('../../structures/chat_bridge/managers/MinecraftChatManager').CommandOptions} commandOptions
	 */
	async _runList(interaction, commandOptions) {
		const hypixelGuild = this.getHypixelGuild(interaction);

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

		switch (interaction.subCommandName) {
			case 'demote': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIgn(interaction);

				return this._run(interaction, {
					command: `g demote ${IGN}`,
					responseRegExp: demote(IGN),
				});
			}

			case 'history': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this._run(interaction, {
					command: `g history ${interaction.options.get('page')?.value ?? ''}`,
					abortRegExp: historyErrors(),
				});
			}

			case 'info':
			case 'motd':
			case 'quest': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this._run(interaction, {
					command: `g ${interaction.subCommandName}`,
				});
			}

			case 'top': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this._run(interaction, {
					command: `g top ${interaction.options.get('days_ago')?.value ?? ''}`,
					abortRegExp: topErrors(),
				});
			}

			case 'invite': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = interaction.options.get('ign').value;

				return this._run(interaction, {
					command: `g invite ${IGN}`,
					responseRegExp: invite(IGN),
				});
			}

			case 'list':
			case 'members':
			case 'online': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('BRIDGER_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				return this._runList(interaction, {
					command: `g ${interaction.subCommandName}`,
				});
			}

			case 'log': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIgn(interaction);
				const PAGE = interaction.options.get('page')?.value;

				return this._run(interaction, {
					command: `g log ${[ IGN, PAGE ].filter(Boolean).join(' ')}`,
					abortRegExp: logErrors(),
				});
			}

			case 'member': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIgn(interaction, true);
				if (!IGN) return interaction.reply({
					content: 'you are not in the player db',
					ephemeral: true,
				});

				return this._run(interaction, {
					command: `g member ${IGN}`,
				});
			}

			case 'mute': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const { players } = this.client;
				const TARGET_INPUT = interaction.options.get('target').value;
				const DURATION_INPUT = interaction.options.get('duration').value;

				let hypixelGuild = this.getHypixelGuild(interaction);
				let target;

				if ([ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
					target = 'everyone';
				} else {
					target = this.getPlayer(interaction) ?? (SlashCommand.checkForce(interaction.options) && TARGET_INPUT);

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

				return this._run(interaction, {
					command: `g mute ${target} ${DURATION_INPUT}`,
					responseRegExp: mute(target === 'everyone' ? 'the guild chat' : target.toString(), hypixelGuild.chatBridge.bot.ign),
				}, hypixelGuild);
			}

			case 'promote': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIgn(interaction);

				return this._run(interaction, {
					command: `g promote ${IGN}`,
					responseRegExp: promote(IGN),
				});
			}

			case 'setrank': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const IGN = this.getIgn(interaction);
				const RANK = interaction.options.get('rank').value;

				return this._run(interaction, {
					command: `g setrank ${IGN} ${RANK}`,
					responseRegExp: setRank(IGN, undefined, RANK),
				});
			}

			case 'unmute': {
				await this.checkPermissions(interaction, {
					roleIds: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ],
				});

				const { players } = this.client;
				const TARGET_INPUT = interaction.options.get('target').value;

				let hypixelGuild = this.getHypixelGuild(interaction);
				let target;

				if ([ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
					target = 'everyone';
				} else {
					target = this.getPlayer(interaction) ?? (SlashCommand.checkForce(interaction.options) && TARGET_INPUT);

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

				return this._run(interaction, {
					command: `g unmute ${target}`,
					responseRegExp: unmute(target === 'everyone' ? 'the guild chat' : `${target}`, hypixelGuild.chatBridge.bot.ign),
				}, hypixelGuild);
			}

			default:
				throw new Error(`unknown subCommandName '${interaction.subCommandName}'`);
		}
	}
};
