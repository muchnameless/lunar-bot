'use strict';

const { Collection } = require('discord.js');
const { dirname, basename } = require('path');
const { getAllJsFiles } = require('../../functions/files');
const logger = require('../../functions/logger');


module.exports = class BaseCommandCollection extends Collection {
	/**
	 * @param {import('../LunarClient')} client
	 * @param {string} dirPath the path to the commands folder
	 * @param {Boolean} [isMainCollection=false]
	 * @param {*} [entries]
	 */
	constructor(client, dirPath, entries = undefined) {
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
	 * @param {Boolean} [isReload=false]
	 */
	async loadAll(isReload = false) {
		const commandFiles = await getAllJsFiles(this.dirPath);

		for (const file of commandFiles) {
			this.loadFromFile(file, isReload);
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
};
