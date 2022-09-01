import { dirname, basename } from 'node:path';
import { Collection } from 'discord.js';
import { logger } from '#logger';
import { autocorrect, readJSFiles } from '#functions';
import type { URL } from 'node:url';
import type { LunarClient } from '../LunarClient';
import type { DualCommand } from './DualCommand';
import type { ApplicationCommand } from './ApplicationCommand';
import type { BridgeCommand } from './BridgeCommand';
import type { BaseCommand } from './BaseCommand';

interface CommandLoadOptions {
	reload?: boolean;
}

export type CommandType = DualCommand | ApplicationCommand | BridgeCommand;

export class BaseCommandCollection<C extends CommandType = CommandType> extends Collection<string, C> {
	declare client: LunarClient;
	/**
	 * path to the command files
	 */
	dirURL: URL;

	/**
	 * @param client
	 * @param dirURL
	 * @param entries
	 */
	constructor(client: LunarClient, dirURL: URL, entries?: readonly [string, C][]) {
		super(entries);

		Object.defineProperty(this, 'client', { value: client });

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
	static INVISIBLE_CATEGORIES = new Set(['hidden', 'owner']);

	/**
	 * clears the cooldown timestamps collection for all commands
	 */
	clearCooldowns() {
		return this.each((command) => command.clearCooldowns());
	}

	/**
	 * loads a single command into the collection
	 * @param commandName
	 * @param options
	 */
	async loadByName(commandName: string, options?: CommandLoadOptions) {
		for await (const path of readJSFiles(this.dirURL)) {
			if (basename(path, '.js').toLowerCase() === commandName) {
				return this.loadFromFile(path, options);
			}
		}

		return null;
	}

	/**
	 * loads a single command into the collection
	 * @param file command file to load
	 * @param options
	 */
	async loadFromFile(file: string, { reload = false }: CommandLoadOptions = {}) {
		const fileName = basename(file, '.js');
		const category = basename(dirname(file));
		const filePath = reload ? `${file}?update=${Date.now()}` : file;

		const Command = (await import(filePath)).default as typeof BaseCommand;
		const command: BaseCommand = new Command({
			client: this.client,
			collection: this,
			fileName,
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

		for await (const path of readJSFiles(this.dirURL)) {
			await this.loadFromFile(path, options);

			++commandCount;
		}

		logger.info(`[COMMANDS]: ${commandCount} command${commandCount !== 1 ? 's' : ''} loaded`);

		return this;
	}

	/**
	 * unload all commands
	 */
	unloadAll() {
		return this.each((command) => command.unload());
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
		command = this.get(value)!;
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		return (command as DualCommand).visible ?? true ? command : null;
	}
}
