'use strict';

const { Constants } = require('discord.js');
const { getIDFromString } = require('../../functions/util');
const missingPermissionsError = require('../errors/MissingPermissionsError');
const logger = require('../../functions/logger');


/**
 * @typedef {import('discord.js').ApplicationCommandData & { aliases: ?string[], permissions: import('discord.js').ApplicationCommandPermissions, cooldown: ?number }} CommandData
 */


module.exports = class SlashCommand {
	/**
	 * create a new command
	 * @param {object} param0
	 * @param {import('../LunarClient')} param0.client discord this.client that instantiated this command
	 * @param {import('./CommandCollection')} param0.collection
	 * @param {string} param0.name command name
	 * @param {CommandData} param1
	 */
	constructor({ client, collection, name }, { aliases, description, options, defaultPermission, permissions, cooldown }) {
		this.client = client;
		this.collection = collection;
		this.name = name;
		/** @type {?string} */
		this.id = null;
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

		this.cooldown = cooldown ?? null;
	}

	static GUILD_OPTION = {
		name: 'guild',
		type: Constants.ApplicationCommandOptionTypes.STRING,
		description: 'hypixel guild',
		required: false,
	};

	static FORCE_OPTION = {
		name: 'force',
		type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
		description: 'disable IGN autocorrection',
		required: false,
	};

	/**
	 * wether the force option was set to true
	 * @param {import('discord.js').Collection<string, import('discord.js').CommandInteractionOption>} options
	 * @returns {boolean}
	 */
	static checkForce(options) {
		return options?.get('force')?.value ?? false;
	}

	/**
	 * @returns {import('discord.js').ApplicationCommandData}
	 */
	get data() {
		return {
			name: this.name,
			description: this.description,
			options: this.options,
			defaultPermission: this.defaultPermission,
		};
	}

	/**
	 * client config
	 */
	get config() {
		return this.client.config;
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	load() {
		this.collection.set(this.name.toLowerCase(), this);
		this.aliases?.forEach(alias => this.collection.set(alias.toLowerCase(), this));
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	unload() {
		this.collection.delete(this.name.toLowerCase());
		this.aliases?.forEach(alias => this.collection.delete(alias.toLowerCase()));

		for (const path of Object.keys(require.cache).filter(filePath => !filePath.includes('node_modules') && !filePath.includes('functions') && filePath.includes('commands') && filePath.endsWith(`${this.name}.js`))) {
			delete require.cache[path];
		}
	}

	/**
	 * returns the player object
	 * @param {import('discord.js').Collection<string, import('discord.js').CommandInteractionOption>} options
	 * @returns {?import('../structures/database/models/Player')}
	 */
	getPlayer(options) {
		if (!options) return null;

		const INPUT = (options.get('player') || options.get('target') || options.get('ign'))?.value;
		const DISCORD_ID = INPUT && getIDFromString(INPUT);

		return (DISCORD_ID
			? this.client.players.getByID(DISCORD_ID)
			: SlashCommand.checkForce(options)
				? this.client.players.findByIGN(INPUT)
				: this.client.players.getByID(INPUT) ?? this.client.players.getByIGN(INPUT)
		) ?? INPUT;
	}

	/**
	 * returns the player object
	 * @param {import('discord.js').Collection<string, import('discord.js').CommandInteractionOption>} options
	 * @returns {?string}
	 */
	getIGN(options) {
		if (!options) return null;

		const INPUT = (options.get('player') || options.get('target') || options.get('ign'))?.value;
		const DISCORD_ID = INPUT && getIDFromString(INPUT);

		return DISCORD_ID
			? this.client.players.getByID(DISCORD_ID)?.ign
			: (SlashCommand.checkForce(options)
				? INPUT
				: (this.client.players.getByID(INPUT)?.ign ?? this.client.players.getByIGN(INPUT)?.ign ?? INPUT)
			);
	}

	/**
	 * @param {import('../extensions/CommandInteraction')} interaction
	 * @param {{ userIDs: import('discord.js').Snowflake[], roleIDs: import('discord.js').Snowflake[] }} permissions
	 */
	async checkPermissions(interaction, { userIDs = [ this.client.ownerID ], roleIDs = [] }) {
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
