'use strict';

const { Collection } = require('discord.js');
const path = require('path');
const { getAllJsFiles } = require('../../functions/files');
const { autocorrect } = require('../../functions/util');
const Command = require('./Command');
const logger = require('../../functions/logger');


class CommandCollection extends Collection {
	/**
	 * @param {import('../LunarClient')} client
	 * @param {*} entries
	 */
	constructor(client, entries) {
		super(entries);

		this.client = client;
		this.aliases = new Map();
	}

	get invisibleCategories() {
		return [ 'hidden', 'owner' ];
	}

	/**
	 * returns all non-hidden commands
	 */
	get visible() {
		return this.filter(command => !this.invisibleCategories.includes(command.category));
	}

	/**
	 * returns all command categories
	 * @returns {string[]}
	 */
	get categories() {
		return [ ...new Set(this.map(command => command.category)) ];
	}

	/**
	 * returns all visible command categories
	 */
	get visibleCategories() {
		return this.categories.filter(category => !this.invisibleCategories.includes(category)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
	}

	/**
	 * returns the commands from the provided category
	 * @param {string} category
	 */
	filterByCategory(category) {
		return this.filter(command => command.category === category);
	}

	/**
	 * get a command by name or by alias
	 * @param {string} name
	 * @returns {?import('./Command')}
	 */
	getByName(name) {
		/**
		 * @type {?import('./Command')}
		 */
		let command = this.get(name) ?? this.get(this.aliases.get(name));
		if (command) return command;

		// don't autocorrect single letters
		if (name.length <= 1) return null;

		// autocorrect input
		const result = autocorrect(name, [ ...this.keys(), ...this.aliases.keys() ].filter(x => x.length > 1));
		if (result.similarity < this.client.config.get('AUTOCORRECT_THRESHOLD')) return null;

		// return command if it is visible
		command = this.get(result.value) ?? this.get(this.aliases.get(result.value));
		return command.visible ? command : null;
	}

	/**
	 * execute the help command
	 * @param  {...any} args
	 */
	help(...args) {
		return this.get('help').run(...args);
	}

	/**
	 * loads a single command into the collection
	 * @param {string} file command file to load
	 */
	load(file) {
		const name = path.basename(file, '.js');
		const category = path.basename(path.dirname(file));
		const commandConstructor = require(file);

		if (Object.getPrototypeOf(commandConstructor) !== Command) throw new Error(`[LOAD COMMAND]: invalid input: ${file}`);

		/**
		 * @type {import('./Command')}
		 */
		const command = new commandConstructor({
			client: this.client,
			name,
			category,
		});

		command.load();
	}

	/**
	 * loads all commands into the collection
	 */
	async loadAll() {
		const commandFiles = await getAllJsFiles(path.join(__dirname, '..', '..', 'commands'));

		for (const file of commandFiles) {
			this.load(file);
		}

		logger.debug(`[COMMANDS]: ${commandFiles.length} command${commandFiles.length !== 1 ? 's' : ''} loaded`);
	}

	/**
	 * unload all commands
	 */
	unloadAll() {
		this.forEach(command => command.unload());
	}
}

module.exports = CommandCollection;
