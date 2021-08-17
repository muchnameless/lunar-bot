import { Collection } from 'discord.js';
import { BaseCommandCollection } from './BaseCommandCollection.js';
import { logger } from '../../functions/logger.js';


export class SlashCommandCollection extends BaseCommandCollection {
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

		await this.setAllPermissions(commands);

		return commands;
	}

	/**
	 * sets all application command permissions
	 * @param {import('discord.js').Collection<import('discord.js').Snowflake, import('discord.js').ApplicationCommand>} applicationCommandsInput
	 */
	async setAllPermissions(applicationCommandsInput) {
		const applicationCommands = applicationCommandsInput ?? await this.client.application.commands.fetch();
		const fullPermissions = [];

		for (const { name, id } of applicationCommands.values()) {
			/** @type {?import('./SlashCommand').SlashCommand} */
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

		return this.client.application.commands.permissions.set({
			guild: this.client.config.get('DISCORD_GUILD_ID'),
			fullPermissions,
		});
	}

	/**
	 * create a new slash command on discord's side
	 * @param {string} commandName
	 * @param {import('discord.js').GuildApplicationCommandManager|import('discord.js').ApplicationCommandManager} [commandManager]
	 */
	async create(commandName, commandManager = this.client.application.commands) {
		/** @type {import('./SlashCommand').SlashCommand} */
		const command = this.get(commandName) ?? await this.loadByName(commandName);

		if (!command) throw new Error(`[COMMANDS CREATE]: unknown command '${commandName}'`);

		const data = [ command.data ];

		// add aliases if existent
		command.aliases?.forEach(alias => data.push({ ...data[0], name: alias }));

		const applicationCommands = await Promise.all(data.map(d => commandManager.create(d)));

		await this.setSinglePermissions({ command, applicationCommands });

		return applicationCommands;
	}

	/**
	 * sets a single application command's permissions (including possible aliases)
	 * @param {{ command: import('./SlashCommand').SlashCommand, applicationCommands: import('discord.js').ApplicationCommand[] }} param0
	 */
	// eslint-disable-next-line no-undef
	async setSinglePermissions({ command = this.getByName(arguments[0]), applicationCommands: applicationCommandsInput }) {
		const applicationCommands = applicationCommandsInput
			?? (await this.client.application.commands.fetch()).filter(c => c.name === command.name || command.aliases?.includes(c.name));
		const { permissions } = command;

		if (permissions?.length) {
			const DISCORD_GUILD_ID = this.client.config.get('DISCORD_GUILD_ID');

			for (const applicationCommand of applicationCommands) {
				await this.client.application.commands.permissions.set({
					guild: DISCORD_GUILD_ID,
					command: applicationCommand,
					permissions,
				});
			}
		}
	}

	/**
	 * deletes an application command
	 * @param {string} commandName
	 * @param {import('discord.js').GuildApplicationCommandManager|import('discord.js').ApplicationCommandManager} [commandManager]
	 */
	async deleteCommand(commandName, commandManager = this.client.application.commands) {
		const commands = await commandManager.fetch();
		const command = commands.find(cmd => cmd.name === commandName.toLowerCase());

		if (!command) throw new Error(`unknown command ${commandName}`);

		return await command.delete();
	}
}
