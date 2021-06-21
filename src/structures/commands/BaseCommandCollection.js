'use strict';

const { Collection } = require('discord.js');
const { dirname, basename } = require('path');
const { getAllJsFiles } = require('../../functions/files');
const { autocorrect } = require('../../functions/util');
const logger = require('../../functions/logger');


module.exports = class BaseCommandCollection extends Collection {
	/**
	 * @param {import('../LunarClient')} client
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

		this.loadFromFile(commandFile);
	}

	/**
	 * loads a single command into the collection
	 * @param {string} file command file to load
	 */
	loadFromFile(file) {
		const name = basename(file, '.js');
		const category = basename(dirname(file));
		const Command = require(file);
		/** @type {import('./DualCommand') | import('./SlashCommand')} */
		const command = new Command({
			client: this.client,
			collection: this,
			name,
			category: category !== 'commands' ? category : null,
		});

		command.load();

		// delete if command won't be loaded again
		delete require.cache[require.resolve(file)];

		return this;
	}

	/**
	 * loads all commands into the collection
	 */
	async loadAll() {
		const commandFiles = await getAllJsFiles(this.dirPath);

		for (const file of commandFiles) {
			this.loadFromFile(file);
		}

		logger.debug(`[COMMANDS]: ${commandFiles.length} command${commandFiles.length !== 1 ? 's' : ''} loaded`);

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
	 * @returns {?import('./BridgeCommand')}
	 */
	getByName(name) {
		/**
		 * @type {?import('./BridgeCommand')}
		 */
		let command = this.get(name);
		if (command) return command;

		// don't autocorrect single letters
		if (name.length <= 1) return null;

		// autocorrect input
		const { value, similarity } = autocorrect(name, this.keyArray().filter(({ length }) => length > 1));
		if (similarity < this.client.config.get('AUTOCORRECT_THRESHOLD')) return null;

		// return command if it is visible
		command = this.get(value);
		return (command.visible ?? true) ? command : null;
	}
};
