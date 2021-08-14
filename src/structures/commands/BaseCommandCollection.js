import { Collection } from 'discord.js';
import { dirname, basename } from 'path';
import { pathToFileURL } from 'url';
import { getAllJsFiles } from '../../functions/files.js';
import { autocorrect } from '../../functions/util.js';
import { logger } from '../../functions/logger.js';


export class BaseCommandCollection extends Collection {
	/**
	 * @param {import('../LunarClient').LunarClient} client
	 * @param {string} dirPath the path to the commands folder
	 * @param {*} [entries]
	 */
	constructor(client, dirPath, entries) {
		super(entries);

		this.client = client;
		/**
		 * path to the command files
		 */
		this.dirPath = dirPath;
	}

	/**
	 * built-in methods will use this as the constructor
	 * that way BaseCommandCollection#filter returns a standard Collection
	 */
	static get [Symbol.species]() {
		return Collection;
	}

	/**
	 * clears the cooldown timestamps collection for all commands
	 */
	clearCooldowns() {
		return this.each(command => command.clearCooldowns());
	}

	/**
	 * loads a single command into the collection
	 * @param {string} commandName
	 */
	async loadByName(commandName) {
		const commandFiles = await getAllJsFiles(this.dirPath);
		const commandFile = commandFiles.find(file => basename(file, '.js').toLowerCase() === commandName);

		if (!commandFile) return;

		return this.loadFromFile(commandFile);
	}

	/**
	 * loads a single command into the collection
	 * @param {string} file command file to load
	 */
	async loadFromFile(file) {
		const name = basename(file, '.js');
		const category = basename(dirname(file));
		const Command = (await import(pathToFileURL(file))).default;
		/** @type {import('./DualCommand').DualCommand | import('./SlashCommand').SlashCommand} */
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
	 */
	async loadAll() {
		const commandFiles = await getAllJsFiles(this.dirPath);

		await Promise.all(commandFiles.map(file => this.loadFromFile(file)));

		logger.info(`[COMMANDS]: ${commandFiles.length} command${commandFiles.length !== 1 ? 's' : ''} loaded`);

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
	 * @param {string} name
	 * @returns {?import('./BridgeCommand').BridgeCommand}
	 */
	getByName(name) {
		/**
		 * @type {?import('./BridgeCommand').BridgeCommand}
		 */
		let command = this.get(name);
		if (command) return command;

		// autocorrect input
		const { value, similarity } = autocorrect(name, this.keys());
		if (similarity < this.client.config.get('AUTOCORRECT_THRESHOLD')) return null;

		// return command if it is visible
		command = this.get(value);
		return (command.visible ?? true) ? command : null;
	}
}
