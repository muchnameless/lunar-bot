import { Collection } from 'discord.js';
import { logger } from '../../functions';
import { BaseCommandCollection } from './BaseCommandCollection';
import { ApplicationCommand } from './ApplicationCommand';
import type {
	ApplicationCommand as DiscordJSApplicationCommand,
	ApplicationCommandManager,
	GuildApplicationCommandManager,
	GuildApplicationCommandPermissionData,
	Snowflake,
} from 'discord.js';
import type { DualCommand } from './DualCommand';


type SlashCommandType = DualCommand | ApplicationCommand;


export class ApplicationCommandCollection<C extends SlashCommandType = SlashCommandType> extends BaseCommandCollection<C> {
	/**
	 * built-in methods will use this as the constructor
	 * that way ApplicationCommandCollection#filter returns a standard Collection
	 */
	static override get [Symbol.species]() {
		return Collection;
	}

	/**
	 * registers all slash commands
	 * @param commandManager
	 */
	async init(commandManager: ApplicationCommandManager | GuildApplicationCommandManager = this.client.application!.commands) {
		const uniqueCommands = [ ...new Set(this.values()) ];
		const commands = await commandManager.set(
			// @ts-expect-error
			uniqueCommands.flatMap(({ data }) => data),
		);

		await this.setAllPermissions(commands);

		return commands;
	}

	/**
	 * sets all application command permissions
	 * @param applicationCommandsInput
	 */
	async setAllPermissions(applicationCommandsInput: Collection<Snowflake, DiscordJSApplicationCommand>) {
		const applicationCommands = applicationCommandsInput ?? await this.client.application!.commands.fetch();
		const fullPermissions: GuildApplicationCommandPermissionData[] = [];

		for (const { name, id } of applicationCommands.values()) {
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

		return this.client.application!.commands.permissions.set({
			guild: this.client.config.get('DISCORD_GUILD_ID'),
			fullPermissions,
		});
	}

	/**
	 * create a new slash command on discord's side
	 * @param commandName
	 * @param commandManager
	 */
	async create(commandName: string, commandManager: ApplicationCommandManager | GuildApplicationCommandManager = this.client.application!.commands) {
		const command = this.get(commandName) ?? await this.loadByName(commandName);

		if (!command) throw new Error(`[COMMANDS CREATE]: unknown command '${commandName}'`);
		if (!(command instanceof ApplicationCommand)) throw new Error(`[COMMANDS CREATE]: ${command.name} is not an ApplicationCommand`);

		const applicationCommands = await Promise.all(command.data.map(d => commandManager.create(
			// @ts-expect-error
			d,
		)));

		await this.setSinglePermissions({ command, applicationCommands });

		return applicationCommands;
	}

	/**
	 * sets a single application command's permissions (including possible aliases)
	 * @param param0
	 */
	// eslint-disable-next-line no-undef
	async setSinglePermissions({ command = this.getByName(arguments[0])!, applicationCommands: applicationCommandsInput }: { command: ApplicationCommand; applicationCommands: DiscordJSApplicationCommand[]; }) {
		const applicationCommands = applicationCommandsInput
			?? (await this.client.application!.commands.fetch()).filter(c => c.name === command.name || (command.aliases?.includes(c.name) ?? false));
		const { permissions } = command;

		if (permissions?.length) {
			const DISCORD_GUILD_ID = this.client.config.get('DISCORD_GUILD_ID');

			for (const applicationCommand of applicationCommands) {
				await this.client.application!.commands.permissions.set({
					guild: DISCORD_GUILD_ID,
					command: applicationCommand,
					permissions,
				});
			}
		}
	}

	/**
	 * deletes an application command
	 * @param commandName
	 * @param commandManager
	 */
	async deleteCommand(commandName: string, commandManager: GuildApplicationCommandManager | ApplicationCommandManager = this.client.application!.commands) {
		const commands = await (commandManager as ApplicationCommandManager).fetch();
		const command = commands.find(cmd => cmd.name === commandName.toLowerCase());

		if (!command) throw new Error(`unknown command ${commandName}`);

		return command.delete();
	}
}
