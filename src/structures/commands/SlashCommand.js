'use strict';

const { Constants } = require('discord.js');
const { skills, cosmeticSkills, slayers, dungeonTypes, dungeonClasses } = require('../../constants/skyblock');
const { XP_OFFSETS_CONVERTER, XP_OFFSETS_SHORT, GUILD_ID_ALL } = require('../../constants/database');
const { getIDFromString } = require('../../functions/util');
const { validateMinecraftUUID } = require('../../functions/stringValidators');
const BaseCommand = require('./BaseCommand');
const missingPermissionsError = require('../errors/MissingPermissionsError');
const logger = require('../../functions/logger');


/**
 * @typedef {import('discord.js').ApplicationCommandData & { aliases: ?string[], permissions: import('discord.js').ApplicationCommandPermissions, cooldown: ?number, requiredRoles: () => import('discord.js').Snowflake[] }} CommandData
 */


module.exports = class SlashCommand extends BaseCommand {
	/**
	 * create a new command
	 * @param {BaseCommand.BaseCommandData} param0
	 * @param {import('../LunarClient')} param0.client discord this.client that instantiated this command
	 * @param {string} param0.name command name
	 * @param {CommandData} param1
	 */
	constructor(param0, { aliases, description, options, defaultPermission, permissions, cooldown, requiredRoles }) {
		super(param0, { cooldown, requiredRoles });

		/** @type {?string[]} */
		this.aliases = aliases?.length ? aliases.filter(Boolean) : null;

		this.description = description?.length ? description : null;
		this.options = options ?? null;
		this.defaultPermission = defaultPermission ?? true;

		this.permissions = permissions ?? null;
		if (this.permissions?.length) this.permissions.push({
			id: this.client.ownerID,
			type: Constants.ApplicationCommandPermissionTypes.USER,
			permission: true,
		});
	}

	static get guildOptionBuilder() {
		/**
		 * @param {import('../LunarClient')} client
		 * @param {boolean} [includeAll=false]
		 */
		return (client, includeAll = false) => {
			const choices = client.hypixelGuilds.cache.map(({ guildID, name }) => ({ name, value: guildID }));

			if (includeAll) choices.push({
				name: 'all',
				value: GUILD_ID_ALL,
			});

			return ({
				name: 'guild',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'hypixel guild',
				required: false,
				choices,
			});
		};
	}

	static get FORCE_OPTION() {
		return {
			name: 'force',
			type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
			description: 'disable IGN autocorrection',
			required: false,
		};
	}

	static get EPHEMERAL_OPTION() {
		return {
			name: 'ephemeral',
			type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
			description: 'wether the response should be ephemeral when not in a commands channel',
			required: false,
		};
	}

	static get XP_TYPE_OPTION() {
		return {
			name: 'type',
			type: Constants.ApplicationCommandOptionTypes.STRING,
			description: 'xp type',
			required: false,
			choices: [ 'weight', { name: 'skill average', value: 'skill-average' }, ...skills, ...cosmeticSkills, 'slayer', ...slayers, ...dungeonTypes, ...dungeonClasses, 'guild' ]
				.map(x => (typeof x !== 'object' ? ({ name: x, value: x }) : x)),
		};
	}

	static get PAGE_OPTION() {
		return {
			name: 'page',
			type: Constants.ApplicationCommandOptionTypes.INTEGER,
			description: 'page number',
			required: false,
		};
	}

	static get OFFSET_OPTION() {
		return {
			name: 'offset',
			type: Constants.ApplicationCommandOptionTypes.STRING,
			description: 'Δ offset',
			required: false,
			choices: Object.keys(XP_OFFSETS_SHORT).map(x => ({ name: x, value: XP_OFFSETS_CONVERTER[x] })),
		};
	}

	/**
	 * wether the force option was set to true
	 * @param {import('discord.js').Collection<string, import('discord.js').CommandInteractionOption>} options
	 * @returns {boolean}
	 */
	static checkForce(options) {
		return options?.get('force')?.value ?? false;
	}

	/**
	 * @param {import('discord.js').ApplicationCommandOptionData} option
	 */
	static isSubCommandOption(option) {
		return option?.type === Constants.ApplicationCommandOptionTypes.SUB_COMMAND || option?.type === Constants.ApplicationCommandOptionTypes.SUB_COMMAND_GROUP;
	}

	/**
	 * @returns {import('discord.js').ApplicationCommandData}
	 */
	get data() {
		/** @type {import('discord.js').ApplicationCommandOptionData[]} */
		let options = [ ...(this.options ?? []) ];

		const [ firstOption ] = options;

		if (SlashCommand.isSubCommandOption(firstOption)) {
			options = options.map((option) => {
				if (option.options[option.options.length - 1]?.name !== 'ephemeral') option.options.push(SlashCommand.EPHEMERAL_OPTION);
				return option;
			});
		} else if (options[options.length - 1]?.name !== 'ephemeral') {
			options.push(SlashCommand.EPHEMERAL_OPTION);
		}

		return {
			name: this.name,
			description: this.description,
			options,
			defaultPermission: this.defaultPermission,
		};
	}

	/**
	 * must not exceed 4k
	 */
	get dataLength() {
		const { data } = this;
		/**
		 * recursively reduces options
		 * @param {import('discord.js').ApplicationCommandData} options
		 * @returns {number}
		 */
		const reduceOptions = options => options?.reduce((a1, c1) => a1 + c1.name.length + c1.description.length + (c1.choices?.reduce((a2, c2) => a2 + c2.name.length + c2.value.length, 0) ?? 0) + reduceOptions(c1.options), 0) ?? 0;

		return data.name.length
			+ data.description.length
			+ reduceOptions(data.options);
	}

	/**
	 * returns the player object, provide interaction parameter for a fallback to interaction.user.player
	 * @param {import('discord.js').Collection<string, import('discord.js').CommandInteractionOption>} options
	 * @param {import('../extensions/CommandInteraction')} interaction
	 * @returns {?import('../database/models/Player')}
	 */
	getPlayer(options, interaction) {
		if (!options) return interaction?.user.player ?? null;

		const INPUT = (options.get('player') || options.get('target'))?.value.toLowerCase();

		if (!INPUT) return interaction?.user.player ?? null;

		if (validateMinecraftUUID(INPUT)) return this.client.players.get(INPUT.replace(/-/g, ''));

		const DISCORD_ID = getIDFromString(INPUT);

		return (DISCORD_ID
			? this.client.players.getByID(DISCORD_ID)
			: SlashCommand.checkForce(options)
				? this.client.players.cache.find(({ ign }) => ign.toLowerCase() === INPUT)
				: this.client.players.getByIGN(INPUT)
		) ?? null;
	}

	/**
	 * returns the player object, provide interaction parameter for a fallback to interaction.user.player.ign
	 * @param {import('discord.js').Collection<string, import('discord.js').CommandInteractionOption>} options
	 * @param {import('../extensions/CommandInteraction')} interaction
	 * @returns {?string}
	 */
	getIGN(options, interaction) {
		return this.getPlayer(options, interaction)?.ign ?? null;
	}

	/**
	 * returns a HypixelGuild instance, throwing if none found
	 * @param {import('discord.js').Collection<string, import('discord.js').CommandInteractionOption>} options
	 * @param {import('../extensions/CommandInteraction')} interaction
	 * @returns {import('../database/models/HypixelGuild') | GUILD_ID_ALL}
	 */
	getHypixelGuild(options, interaction) {
		const INPUT = options?.get('guild')?.value;
		if (INPUT === GUILD_ID_ALL) return INPUT;
		return this.client.hypixelGuilds.cache.get(INPUT) ?? interaction?.user.player?.guild ?? this.client.hypixelGuilds.mainGuild;
	}

	/**
	 * @param {import('../extensions/CommandInteraction')} interaction
	 * @param {{ userIDs: import('discord.js').Snowflake[], roleIDs: import('discord.js').Snowflake[] }} [permissions]
	 */
	async checkPermissions(interaction, { userIDs = [ this.client.ownerID ], roleIDs = this.requiredRoles } = {}) {
		if (userIDs?.includes(interaction.user.id)) return; // user id bypass
		if (!roleIDs?.length) return; // no role requirements

		/** @type {import('../extensions/GuildMember')} */
		const member = interaction.guildID === this.config.get('MAIN_GUILD_ID')
			? interaction.member
			: await (async () => {
				const { lgGuild } = this.client;

				if (!lgGuild) throw missingPermissionsError('discord server unreachable', interaction, roleIDs);

				try {
					return await lgGuild.members.fetch(interaction.user.id);
				} catch (error) {
					logger.error('[CHECK PERMISSIONS]: error while fetching member to test for permissions', error);
					throw missingPermissionsError('unknown discord member', interaction, roleIDs);
				}
			})();

		// check for req roles
		if (!member.roles.cache.some((_, roleID) => roleIDs.includes(roleID))) {
			throw missingPermissionsError('missing required role', interaction, roleIDs);
		}
	}

	/**
	 * execute the command
	 * @param {import('../extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		throw new Error('no run function specified');
	}
};
