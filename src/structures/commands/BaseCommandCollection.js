import { Collection } from 'discord.js';
import { dirname, basename } from 'path';
import { pathToFileURL } from 'url';
import { autocorrect, getAllJsFiles, logger } from '../../functions/index.js';


/**
 * @typedef {object} CommandLoadOptions
 * @property {boolean} [reload=false] wether to reload the imported file
 */


export class BaseCommandCollection extends Collection {
	/**
	 * @param {import('../LunarClient').LunarClient} client
	 * @param {URL} dirURL the path to the commands folder
	 * @param {*} [entries]
	 */
	constructor(client, dirURL, entries) {
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
	static get [Symbol.species]() {
		return Collection;
	}

	/**
	 * clears the cooldown timestamps collection for all commands
	 */
	clearCooldowns() {
		return this.each((/** @type {import('./BaseCommand').BaseCommand} */ command) => command.clearCooldowns());
	}

	/**
	 * loads a single command into the collection
	 * @param {string} commandName
	 * @param {CommandLoadOptions} [options]
	 */
	async loadByName(commandName, options) {
		const commandFiles = await getAllJsFiles(this.dirURL);
		const commandFile = commandFiles.find(file => basename(file, '.js').toLowerCase() === commandName);

		if (!commandFile) return;

		return this.loadFromFile(commandFile, options);
	}

	/**
	 * loads a single command into the collection
	 * @param {string} file command file to load
	 * @param {CommandLoadOptions} [options]
	 */
	async loadFromFile(file, { reload = false } = {}) {
		const name = basename(file, '.js');
		const category = basename(dirname(file));

		let filePath = pathToFileURL(file).href;
		if (reload) filePath = `${filePath}?update=${Date.now()}`;

		const Command = (await import(filePath)).default;
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
	 * @param {CommandLoadOptions} [options]
	 */
	async loadAll(options) {
		const commandFiles = await getAllJsFiles(this.dirURL);

		await Promise.all(commandFiles.map(file => this.loadFromFile(file, options)));

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
