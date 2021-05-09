'use strict';

const { MessageEmbed, Constants } = require('discord.js');
const {
	demote: { regExp: demote },
	invite: { regExp: invite },
	mute: { regExp: mute },
	promote: { regExp: promote },
	setRank: { regExp: setRank },
	unmute: { regExp: unmute },
} = require('../structures/chat_bridge/constants/commandResponses');
const { removeMcFormatting } = require('../structures/chat_bridge/functions/util');
const { getIDFromString, stringToMS } = require('../functions/util');
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
				options: [],
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
				options: [],
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
	 * @param {import('discord.js').CommandInteraction} interaction
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
					logger.error(`[CHECK PERMISSIONS]: error while fetching member to test for permissions: ${error}`);
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 * @param {string} command
	 * @param {RegExp} [responseRegExp]
	 * @param {?import('../structures/database/models/HypixelGuild')} [hypixelGuildInput]
	 */
	async _run(interaction, options, command, responseRegExp, hypixelGuildInput) {
		await interaction.defer();

		const hypixelGuildArgInput = options?.find(({ name }) => name === 'guild')?.value;
		/**
		 * @type {import('../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = hypixelGuildInput ?? (hypixelGuildArgInput
			? (() => {
				const { value, similarity } = this.client.hypixelGuilds.autocorrectToGuild(hypixelGuildArgInput);

				if (similarity <= this.config.get('AUTOCORRECT_THRESHOLD')) return null;

				return value;
			})()
			: interaction.user.player?.guild);

		if (!hypixelGuild) return interaction.editReply('unable to find your guild');

		const { chatBridge } = hypixelGuild;

		try {
			const response = await chatBridge.minecraft.command({
				command,
				responseRegExp,
			});

			return interaction.editReply(new MessageEmbed()
				.setColor(this.config.get('EMBED_BLUE'))
				.setTitle(`/${command}`)
				.setDescription(`\`\`\`\n${response}\`\`\``)
				.setTimestamp(),
			);
		} catch (error) {
			logger.error(`[MODERATION]: '${command}'`, error);
			interaction.editReply(`an error occurred while executing \`${command}\``);
		}
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 * @param {string} command
	 */
	async _runList(interaction, options, command) {
		await interaction.defer();

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

		if (!hypixelGuild) return interaction.editReply('unable to find your guild');

		const data = await hypixelGuild.chatBridge.minecraft.command({
			command,
			raw: true,
		});

		return interaction.editReply(new MessageEmbed()
			.setColor(this.config.get('EMBED_BLUE'))
			.setTitle(`/${command}`)
			.setDescription(
				`\`\`\`${
					data
						.map(msg => (msg.content.includes('●')
							? removeMcFormatting(
								msg.formattedContent
								.replace(/§r§c ●/g, ' 🔴')
								.replace(/§r§a ●/g, ' 🟢')
								.replace(/\[.+?\] /g, ''),
							)
							: msg.content),
						)
						.join('\n')
				}\`\`\``,
			)
			.setTimestamp(),
		);
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		const [{ name, options }] = interaction.options;

		switch (name) {
			case 'demote': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const [{ value: IGN_INPUT }] = options;
				const IGN = this.getIGN(IGN_INPUT, options);

				return this._run(interaction, options, `g demote ${IGN}`, demote(IGN));
			}

			case 'history':
			case 'info':
			case 'motd':
			case 'quest':
			case 'top': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				return this._run(interaction, options, `g ${name}`);
			}

			case 'invite': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const [{ value: IGN }] = options;

				return this._run(interaction, options, `g invite ${IGN}`, invite(IGN));
			}

			case 'list':
			case 'members':
			case 'online': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				return this._runList(interaction, options, `g ${name}`);
			}

			case 'log': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				return this._run(interaction, options, `g log ${options?.flatMap(({ name: arg, value }) => (arg === 'ign' || arg === 'page' ? value : [])).join(' ')}`);
			}

			case 'member': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('GUILD_ROLE_ID'), this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const IGN_INPUT = options?.find(({ name: arg }) => arg === 'ign')?.value;
				const IGN = IGN_INPUT
					? this.getIGN(IGN_INPUT, options)
					: interaction.user.player?.ign;

				if (!IGN) return interaction.reply('you are not in the player db');

				return this._run(interaction, options, `g member ${IGN}`);
			}

			case 'mute': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const { players } = this.client;
				const [{ value: TARGET_INPUT }, { value: DURATION_INPUT }] = options;
				const hypixelGuildInput = options?.find(({ name: arg }) => arg === 'guild')?.value;

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

				if (hypixelGuild || [ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
					target = 'everyone';
					hypixelGuild ??= interaction.user.hypixelGuild;

					if (!hypixelGuild) return interaction.reply('unable to find your guild');
				} else {
					target = this.getPlayer(TARGET_INPUT, options);

					if (!target) return interaction.reply(`no player with the IGN \`${TARGET_INPUT}\` found`);

					if (target instanceof players.model) {
						({ guild: hypixelGuild } = target);

						if (!hypixelGuild) return interaction.reply(`unable to find the guild for \`${target.ign}\``);
					} else {
						hypixelGuild ??= interaction.user.hypixelGuild;

						if (!hypixelGuild) return interaction.reply('unable to find your guild.');
					}
				}

				const DURATION = stringToMS(DURATION_INPUT);

				if (Number.isNaN(DURATION)) return interaction.reply(`\`${DURATION_INPUT}\` is not a valid duration.`);

				const EXPIRES_AT = Date.now() + DURATION;

				if (target instanceof players.model) {
					target.chatBridgeMutedUntil = EXPIRES_AT;
					await target.save();

					if (target.notInGuild) return interaction.reply(`muted \`${target}\` for \`${DURATION_INPUT}\`.`);
				} else if (target === 'everyone') {
					hypixelGuild.chatMutedUntil = EXPIRES_AT;
					await hypixelGuild.save();
				}

				return this._run(interaction, options, `g mute ${target} ${DURATION_INPUT}`, mute(target === 'everyone' ? 'the guild chat' : target.toString(), hypixelGuild.chatBridge.bot.ign), hypixelGuild);
			}

			case 'promote': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const [{ value: IGN_INPUT }] = options;
				const IGN = this.getIGN(IGN_INPUT, options);

				return this._run(interaction, options, `g promote ${IGN}`, promote(IGN));
			}

			case 'setrank': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const [{ value: IGN_INPUT }, { value: RANK }] = options;
				const IGN = this.getIGN(IGN_INPUT, options);

				return this._run(interaction, options, `g setrank ${IGN} ${RANK}`, setRank(IGN, undefined, RANK));
			}

			case 'unmute': {
				await this.checkPermissions(interaction, { roleIDs: [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] });

				const { players } = this.client;
				const [{ value: TARGET_INPUT }] = options;
				const hypixelGuildInput = options?.find(({ name: arg }) => arg === 'guild')?.value;

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

				if (hypixelGuild || [ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
					target = 'everyone';
					hypixelGuild ??= interaction.user.hypixelGuild;

					if (!hypixelGuild) return interaction.reply('unable to find your guild.');
				} else {
					target = this.getPlayer(TARGET_INPUT, options);

					if (!target) return interaction.reply(`no player with the IGN \`${TARGET_INPUT}\` found`);

					if (target instanceof players.model) {
						({ guild: hypixelGuild } = target);

						if (!hypixelGuild) return interaction.reply(`unable to find the guild for \`${target.ign}\``);
					} else {
						hypixelGuild ??= interaction.user.hypixelGuild;

						if (!hypixelGuild) return interaction.reply('unable to find your guild.');
					}
				}

				if (target instanceof players.model) {
					target.chatBridgeMutedUntil = 0;
					await target.save();

					if (target.notInGuild) return interaction.reply(`unmuted \`${target}\`.`);
				} else if (target === 'everyone') {
					hypixelGuild.chatMutedUntil = 0;
					await hypixelGuild.save();
				}

				return this._run(interaction, options, `g unmute ${target}`, unmute(target === 'everyone' ? 'the guild chat' : target.toString(), hypixelGuild.chatBridge.bot.ign), hypixelGuild);
			}

			default:
				throw new Error('unknown command');
		}
	}
};
