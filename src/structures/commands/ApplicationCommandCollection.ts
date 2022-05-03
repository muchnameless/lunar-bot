import { Collection } from 'discord.js';
import { BaseCommandCollection } from './BaseCommandCollection';
import { ApplicationCommand } from './ApplicationCommand';
import type { ApplicationCommandManager, GuildApplicationCommandManager } from 'discord.js';
import type { DualCommand } from './DualCommand';

type SlashCommandType = DualCommand | ApplicationCommand;

export class ApplicationCommandCollection<
	C extends SlashCommandType = SlashCommandType,
> extends BaseCommandCollection<C> {
	/**
	 * built-in methods will use this as the constructor
	 * that way ApplicationCommandCollection#filter returns a standard Collection
	 */
	static override get [Symbol.species]() {
		return Collection;
	}

	/**
	 * command data ready to be deployed to the API
	 */
	get apiData() {
		return [...new Set(this.values())].flatMap(({ data }) => data);
	}

	/**
	 * registers all slash commands
	 * @param commandManager
	 */
	init(commandManager: ApplicationCommandManager | GuildApplicationCommandManager = this.client.application!.commands) {
		return commandManager.set(this.apiData);
	}

	/**
	 * create a new slash command on discord's side
	 * @param commandName
	 * @param commandManager
	 */
	async create(
		commandName: string,
		commandManager: ApplicationCommandManager | GuildApplicationCommandManager = this.client.application!.commands,
	) {
		const command = this.get(commandName) ?? (await this.loadByName(commandName));

		if (!command) throw new Error(`[COMMANDS CREATE]: unknown command '${commandName}'`);
		if (!(command instanceof ApplicationCommand)) {
			throw new TypeError(`[COMMANDS CREATE]: ${command.name} is not an ApplicationCommand`);
		}

		return Promise.all(command.data.map((d) => commandManager.create(d)));
	}

	/**
	 * deletes an application command
	 * @param commandName
	 * @param commandManager
	 */
	async deleteCommand(
		commandName: string,
		commandManager: GuildApplicationCommandManager | ApplicationCommandManager = this.client.application!.commands,
	) {
		const commands = await (commandManager as ApplicationCommandManager).fetch();
		const command = commands.find((cmd) => cmd.name === commandName.toLowerCase());

		if (!command) throw new Error(`unknown command ${commandName}`);

		return command.delete();
	}
}
