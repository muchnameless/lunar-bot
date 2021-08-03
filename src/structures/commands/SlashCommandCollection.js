'use strict';

const { Collection, Constants } = require('discord.js');
const BaseCommandCollection = require('./BaseCommandCollection');
const logger = require('../../functions/logger');


module.exports = class SlashCommandCollection extends BaseCommandCollection {
	/**
	 * built-in methods will use this as the constructor
	 * that way SlashCommandCollection#filter returns a standard Collection
	 */
	static get [Symbol.species]() {
		return Collection;
	}

	/**
	 * registers all slash commands
	 * @param {import('discord.js').GuildApplicationCommandManager|import('discord.js').ApplicationCommandManager} [commandManager]
	 */
	async init(commandManager = this.client.application.commands) {
		const commands = await commandManager.set(this.map(({ data }, name) => ({ ...data, name })));

		await this.setPermissions(commands);

		return commands;
	}

	/**
	 * sets all application command permissions
	 * @param {import('discord.js').Collection<import('discord.js').Snowflake, import('discord.js').ApplicationCommand>} applicationCommandsInput
	 */
	async setPermissions(applicationCommandsInput) {
		const applicationCommands = applicationCommandsInput ?? await this.client.application.commands.fetch();
		const { lgGuild } = this.client;
		const fullPermissions = [];

		for (const { name, id } of applicationCommands.values()) {
			/** @type {?import('./SlashCommand')} */
			const command = this.client.commands.get(name);

			if (!command) {
				logger.warn(`unknown application command '${name}'`);
				continue;
			}

			const { permissions } = command;

			if (!permissions) {
				logger.info(`no permissions to set for '${name}'`);
				continue;
			}

			fullPermissions.push({
				id,
				permissions,
			});
		}

		return lgGuild.commands.permissions.set({ fullPermissions });
	}

	/**
	 * create a new slash command on discord's side
	 * @param {string} commandName
	 */
	async create(commandName) {
		/** @type {import('./SlashCommand')} */
		const command = this.get(commandName) ?? await this.loadByName(commandName);

		if (!command) throw new Error(`[COMMANDS CREATE]: unknown command '${commandName}'`);

		const data = [ command.data ];

		// add aliases if existent
		command.aliases?.forEach(alias => data.push({ ...data[0], name: alias }));

		const result = await Promise.all(data.map(d => this.client.application.commands.create(d)));
		const { permissions } = command;
		const { lgGuild } = this.client;

		for (const { id } of result) {
			await lgGuild.commands.permissions.set({
				id,
				permissions,
			});
		}

		return result;
	}
};
