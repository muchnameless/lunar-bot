'use strict';

const { Constants } = require('discord.js');
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

		/** @type {?string} */
		this.aliases = aliases?.length ? aliases.filter(Boolean) : null;

		this.description = description?.length ? description : null;
		this.options = options ?? null;
		this.defaultPermission = defaultPermission ?? true;

		this.permissions = permissions ?? null;
		if (this.permissions?.length) this.permissions.push({
			id: this.client.ownerID,
			type: 'USER',
			permission: true,
		});
	}

	/**
	 * @param {import('../LunarClient')} client
	 */
	static guildOptionBuilder = client => ({
		name: 'guild',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'hypixel guild',
		required: false,
		choices: client.hypixelGuilds.cache.map(({ guildID, name }) => ({ name, value: guildID })),
	});

	static FORCE_OPTION = {
		name: 'force',
		type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
		description: 'disable IGN autocorrection',
		required: false,
	};

	static EPHEMERAL_OPTION = {
		name: 'ephemeral',
		type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
		description: 'wether the response should be ephemeral when not in a commands channel',
		required: false,
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
		let options = this.options ?? [];

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
	 * returns the player object, provide interaction parameter for a fallback to interaction.user.player
	 * @param {import('discord.js').Collection<string, import('discord.js').CommandInteractionOption>} options
	 * @param {import('../extensions/CommandInteraction')} interaction
	 * @returns {?import('../database/models/Player')}
	 */
	getPlayer(options, interaction) {
		if (!options) return null;

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
	 */
	getHypixelGuild(options, interaction) {
		const hypixelGuild = this.client.hypixelGuilds.cache.get(options?.get('guild')?.value) ?? interaction?.user.player?.guild;

		if (!hypixelGuild) throw `unable to find ${options?.has('guild') ? `a guild with the id \`${options?.get('guild')?.value}\`` : 'your guild'}`;

		return hypixelGuild;
	}

	/**
	 * @param {import('../extensions/CommandInteraction')} interaction
	 * @param {{ userIDs: import('discord.js').Snowflake[], roleIDs: import('discord.js').Snowflake[] }} permissions
	 */
	async checkPermissions(interaction, { userIDs = [ this.client.ownerID ], roleIDs = this.requiredRoles }) {
		if (!userIDs.length && !roleIDs.length) return;
		if (userIDs.includes(interaction.user.id)) return; // user id bypass

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
