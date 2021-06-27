'use strict';

const { Collection, GuildApplicationCommandManager } = require('discord.js');
const BaseCommandCollection = require('./BaseCommandCollection');
// const logger = require('../../functions/logger');


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
	async init(commandManager = this.client.lgGuild?.commands) {
		const commands = await commandManager.set(this.map(({ data }, name) => ({ ...data, name })));
		const permissions = [];

		for (const applicationCommand of commands.values()) {
			/** @type {import('./DualCommand') | import('./SlashCommand')} */
			const slashCommand = this.get(applicationCommand.name);

			if (slashCommand.permissions) {
				permissions.push({
					id: applicationCommand.id,
					permissions: slashCommand.permissions,
				});
			}
		}

		if (permissions.length) {
			if (commandManager instanceof GuildApplicationCommandManager) {
				await commandManager.setPermissions(permissions);
			} else { // permissions for global commands must be set per guild
				for (const guild of this.client.guilds.cache.values()) {
					guild.commands.setPermissions(permissions);
				}
			}
		}

		return commands;
	}

	/**
	 * create a new slash command on discord's side
	 * @param {string} commandName
	 */
	async create(commandName) {
		/** @type {import('./SlashCommand')} */
		const command = this.get(commandName) ?? await this.loadByName(commandName);

		if (!command) throw new Error(`[COMMANDS CREATE]: unknown command '${commandName}'`);

		return this.client.application.commands.create(command.data);
	}
};
