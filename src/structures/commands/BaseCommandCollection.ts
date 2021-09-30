import { Collection } from 'discord.js';
import { dirname, basename } from 'node:path';
import { URL, pathToFileURL } from 'node:url';
import { autocorrect, logger, readJSFiles } from '../../functions';
import type { LunarClient } from '../LunarClient';
import type { DualCommand } from './DualCommand';
import type { SlashCommand } from './SlashCommand';
import type { BridgeCommand } from './BridgeCommand';


interface CommandLoadOptions {
	reload?: boolean;
}

type CommandType = DualCommand | SlashCommand | BridgeCommand;


export class BaseCommandCollection<C extends CommandType = CommandType> extends Collection<string, C> {
	client: LunarClient;
	dirURL: URL;

	/**
	 * @param client
	 * @param dirURL the path to the commands folder
	 * @param entries
	 */
	constructor(client: LunarClient, dirURL: URL, entries?: readonly [ string, C ][]) {
		super(entries);

		this.client = client;
		/**
		 * path to the command files
		 */
		this.dirURL = dirURL;
	}

	/**
	 * built-in methods will use this as the constructor
	 * that way BaseCommandCollection#filter returns a standard Collection
	 */
	static override get [Symbol.species]() {
		return Collection;
	}

	/**
	 * categories that are excluded from the help command and autocorrection
	 */
	static INVISIBLE_CATEGORIES = [ 'hidden', 'owner' ];


	/**
	 * clears the cooldown timestamps collection for all commands
	 */
	clearCooldowns() {
		return this.each(command => command.clearCooldowns());
	}

	/**
	 * loads a single command into the collection
	 * @param commandName
	 * @param options
	 */
	async loadByName(commandName: string, options?: CommandLoadOptions) {
		for await (const dir of readJSFiles(this.dirURL)) {
			if (dir.basename.slice(0, -'.js'.length).toLowerCase() === commandName) return this.loadFromFile(dir.fullPath, options);
		}

		return null;
	}

	/**
	 * loads a single command into the collection
	 * @param file command file to load
	 * @param options
	 */
	async loadFromFile(file: string, { reload = false }: CommandLoadOptions = {}) {
		const name = basename(file, '.js');
		const category = basename(dirname(file));

		let filePath = pathToFileURL(file).href;
		if (reload) filePath = `${filePath}?update=${Date.now()}`;

		const Command = (await import(filePath)).default as typeof DualCommand | typeof SlashCommand | typeof BridgeCommand;
		const command = new Command({
			client: this.client,
			collection: this,
			name,
			category: category !== 'commands' ? category : null,
		});

		command.load();

		return command;
	}

	/**
	 * loads all commands into the collection
	 * @param options
	 */
	async loadAll(options?: CommandLoadOptions) {
		let commandCount = 0;

		for await (const { fullPath } of readJSFiles(this.dirURL)) {
			await this.loadFromFile(fullPath, options);

			++commandCount;
		}

		logger.info(`[COMMANDS]: ${commandCount} command${commandCount !== 1 ? 's' : ''} loaded`);

		return this;
	}

	/**
	 * unload all commands
	 */
	unloadAll() {
		return this.each(command => command.unload());
	}

	/**
	 * get a command by name or by alias
	 * @param name
	 */
	getByName(name: string) {
		let command = this.get(name);
		if (command) return command;

		// autocorrect input
		const { value, similarity } = autocorrect(name, this.keys());
		if (similarity < this.client.config.get('AUTOCORRECT_THRESHOLD')) return null;

		// return command if it is visible
		command = this.get(value) as C;
		return (command.visible ?? true) ? command : null;
	}
}
