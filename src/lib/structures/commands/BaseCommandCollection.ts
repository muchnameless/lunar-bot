import { dirname, basename } from 'node:path';
import { type URL } from 'node:url';
import { Collection } from 'discord.js';
import { type ApplicationCommand } from './ApplicationCommand.js';
import { type BaseCommand } from './BaseCommand.js';
import { type BridgeCommand } from './BridgeCommand.js';
import { type DualCommand } from './DualCommand.js';
import { autocorrect, readJSFiles } from '#functions';
import { logger } from '#logger';
import { type LunarClient } from '#structures/LunarClient.js';

interface CommandLoadOptions {
	reload?: boolean;
}

export type CommandType = ApplicationCommand | BridgeCommand | DualCommand;

export class BaseCommandCollection<C extends CommandType = CommandType> extends Collection<string, C> {
	public declare readonly client: LunarClient;

	/**
	 * path to the command files
	 */
	public readonly dirURL: URL;

	/**
	 * categories that are excluded from the help command and autocorrection
	 */
	public static readonly INVISIBLE_CATEGORIES = new Set(['hidden', 'owner']);

	/**
	 * @param client
	 * @param dirURL
	 * @param entries
	 */
	public constructor(client: LunarClient, dirURL: URL, entries?: readonly [string, C][]) {
		super(entries);

		Object.defineProperty(this, 'client', { value: client });

		this.dirURL = dirURL;
	}

	/**
	 * built-in methods will use this as the constructor
	 * that way BaseCommandCollection#filter returns a standard Collection
	 */
	public static override get [Symbol.species]() {
		return Collection;
	}

	/**
	 * clears the cooldown timestamps collection for all commands
	 */
	public clearCooldowns() {
		return this.each((command) => command.clearCooldowns());
	}

	/**
	 * loads a single command into the collection
	 *
	 * @param commandName
	 * @param options
	 */
	public async loadByName(commandName: string, options?: CommandLoadOptions) {
		for await (const path of readJSFiles(this.dirURL)) {
			if (basename(path, '.js').toLowerCase() === commandName) {
				return this.loadFromFile(path, options);
			}
		}

		return null;
	}

	/**
	 * loads a single command into the collection
	 *
	 * @param file - command file to load
	 * @param options
	 */
	public async loadFromFile(file: string, { reload = false }: CommandLoadOptions = {}) {
		const fileName = basename(file, '.js');
		const category = basename(dirname(file));
		const filePath = reload ? `${file}?update=${Date.now()}` : file;

		const Command = (await import(filePath)).default as typeof BaseCommand;
		const command: BaseCommand = new Command({
			client: this.client,
			collection: this,
			fileName,
			category: category === 'commands' ? null : category,
		});

		command.load();

		return command;
	}

	/**
	 * loads all commands into the collection
	 *
	 * @param options
	 */
	public async loadAll(options?: CommandLoadOptions) {
		let commandCount = 0;

		for await (const path of readJSFiles(this.dirURL)) {
			await this.loadFromFile(path, options);

			++commandCount;
		}

		logger.info(`[COMMANDS]: ${commandCount} command${commandCount === 1 ? '' : 's'} loaded`);

		return this;
	}

	/**
	 * unload all commands
	 */
	public unloadAll() {
		return this.each((command) => command.unload());
	}

	/**
	 * get a command by name or by alias
	 *
	 * @param name
	 */
	public getByName(name: string) {
		let command = this.get(name);
		if (command) return command;

		// autocorrect input
		const { value, similarity } = autocorrect(name, this.keys());
		if (similarity < this.client.config.get('AUTOCORRECT_THRESHOLD')) return null;

		// return command if it is visible
		command = this.get(value)!;
		return (command as DualCommand).visible ?? true ? command : null;
	}
}
