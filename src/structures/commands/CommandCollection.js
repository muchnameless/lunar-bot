'use strict';

const { Collection } = require('discord.js');
const { dirname, basename } = require('path');
const { getAllJsFiles } = require('../../functions/files');
const { autocorrect } = require('../../functions/util');
const logger = require('../../functions/logger');


class CommandCollection extends Collection {
	/**
	 * @param {import('../LunartClient')} client
	 * @param {string} dirPath the path to the commands folder
	 * @param {*} entries
	 */
	constructor(client, dirPath, entries) {
		super(entries);

		this.client = client;
		this.dirPath = dirPath;
		/**
		 * @type {Map<string, string>}
		 */
		this.aliases = new Map();
		/**
		 * @type {Collection<string, Collection<string, number>>}
		 */
		this.cooldowns = new Collection();
	}

	/**
	 * checks wether the array includes 'f' or 'force'
	 * @param {string[]} array
	 */
	static force(array) {
		return array.some(x => [ 'f', 'force' ].includes(x));
	}

	/**
	 * built-in methods will use this as the constructor
	 * that way <CommandCollection>.filter returns a standard Collection
	 */
	static get [Symbol.species]() {
		return Collection;
	}

	get invisibleCategories() {
		return [ 'hidden', 'owner' ];
	}

	/**
	 * returns all non-hidden commands
	 */
	get visible() {
		return this.filter(({ category }) => !this.invisibleCategories.includes(category));
	}

	/**
	 * returns all command categories
	 * @returns {string[]}
	 */
	get categories() {
		return [ ...new Set(this.map(({ category }) => category)) ];
	}

	/**
	 * returns all visible command categories
	 */
	get visibleCategories() {
		return this.categories.filter(category => !this.invisibleCategories.includes(category)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
	}

	/**
	 * help command run method
	 * @type {Function}
	 */
	get help() {
		return this.get('help').run;
	}

	/**
	 * returns the commands from the provided category
	 * @param {string} categoryInput
	 */
	filterByCategory(categoryInput) {
		return this.filter(({ category }) => category === categoryInput);
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
		const { value, similarity } = autocorrect(name, [ ...this.keys(), ...this.aliases.keys() ]);
		if (similarity < this.client.config.get('AUTOCORRECT_THRESHOLD')) return null;

		// return command if it is visible
		command = this.get(value) ?? this.get(this.aliases.get(value));
		return command.visible ? command : null;
	}

	/**
	 * loads a single command into the collection
	 * @param {string} file command file to load
	 */
	load(file) {
		const name = basename(file, '.js');
		const category = basename(dirname(file));
		const Command = require(file);
		/**
		 * @type {import('./Command')}
		 */
		const command = new Command({
			client: this.client,
			commandCollection: this,
			name,
			category: category !== 'commands' ? category : null,
		});

		command.load();

		delete require.cache[require.resolve(file)];

		return this;
	}

	/**
	 * loads all commands into the collection
	 */
	async loadAll() {
		const commandFiles = await getAllJsFiles(this.dirPath);

		for (const file of commandFiles) {
			this.load(file);
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
}

module.exports = CommandCollection;
