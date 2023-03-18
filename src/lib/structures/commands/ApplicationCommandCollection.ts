import { Collection, type ApplicationCommandManager, type GuildApplicationCommandManager } from 'discord.js';
import { ApplicationCommand } from './ApplicationCommand.js';
import { BaseCommandCollection } from './BaseCommandCollection.js';
import type { DualCommand } from './DualCommand.js';

type SlashCommandType = ApplicationCommand | DualCommand;

export class ApplicationCommandCollection<
	C extends SlashCommandType = SlashCommandType,
> extends BaseCommandCollection<C> {
	/**
	 * built-in methods will use this as the constructor
	 * that way ApplicationCommandCollection#filter returns a standard Collection
	 */
	public static override get [Symbol.species]() {
		return Collection;
	}

	/**
	 * command data ready to be deployed to the API
	 */
	public get apiData() {
		return [...new Set(this.values())].flatMap(({ data }) => data);
	}

	/**
	 * registers all slash commands
	 *
	 * @param commandManager
	 */
	public async init(
		commandManager: ApplicationCommandManager | GuildApplicationCommandManager = this.client.application.commands,
	) {
		return commandManager.set(this.apiData);
	}

	/**
	 * create a new slash command on discord's side
	 *
	 * @param commandName
	 * @param commandManager
	 */
	public async create(
		commandName: string,
		commandManager: ApplicationCommandManager | GuildApplicationCommandManager = this.client.application.commands,
	) {
		const command = this.get(commandName) ?? (await this.loadByName(commandName));

		if (!command) throw new Error(`[COMMANDS CREATE]: unknown command '${commandName}'`);
		if (!(command instanceof ApplicationCommand)) {
			throw new TypeError(`[COMMANDS CREATE]: ${command.name} is not an ApplicationCommand`);
		}

		return Promise.all(command.data.map(async (data) => commandManager.create(data)));
	}

	/**
	 * deletes an application command
	 *
	 * @param commandName
	 * @param commandManager
	 */
	public async deleteCommand(
		commandName: string,
		commandManager: ApplicationCommandManager | GuildApplicationCommandManager = this.client.application.commands,
	) {
		const commands = await (commandManager as ApplicationCommandManager).fetch();
		const command = commands.find((cmd) => cmd.name === commandName.toLowerCase());

		if (!command) throw new Error(`unknown command ${commandName}`);

		return command.delete();
	}
}
