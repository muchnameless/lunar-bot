'use strict';

const { Collection } = require('discord.js');
const { dirname, basename, join } = require('path');
const { getAllJsFiles } = require('../../functions/files');
const { autocorrect } = require('../../functions/util');
const logger = require('../../functions/logger');


class CommandCollection extends Collection {
	/**
	 * @param {import('../LunartClient')} client
	 * @param {string} dirPath the path to the commands folder
	 * @param {Boolean} [isMainCollection=false]
	 * @param {*} [entries]
	 */
	constructor(client, dirPath, isMainCollection = false, entries = undefined) {
		super(entries);

		this.client = client;
		/**
		 * path to the command files
		 */
		this.dirPath = dirPath;
		/**
		 * wether the collection is the main collection directly attached to the discord client
		 */
		this.isMainCollection = isMainCollection;
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
	async help(message, ...args) {
		try {
			return await this.get('help').run(message, ...args);
		} catch (error) {
			logger.error(`[CMD HANDLER]: An error occured while ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute ${message.content} in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'}:`, error);
			message.reply(`an error occured while executing the \`help\` command:\n${error.name}: ${error.message}`);
		}
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

	async loadByName(commandName) {
		const commandFiles = await getAllJsFiles(this.dirPath);
		const commandFile = commandFiles.find(file => basename(file, '.js').toLowerCase() === commandName);

		if (!commandFile) return;

		this.loadFromFile(commandFile);
	}

	/**
	 * loads a single command into the collection
	 * @param {string} file command file to load
	 * @param {Boolean} [isReload=false]
	 */
	loadFromFile(file, isReload = false) {
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

		if (this.isMainCollection) {
			try {
				require(file.replace('commands', join('structures', 'chat_bridge', 'commands')));
				command.isBridgeCommand = true;
			} catch {
				command.isBridgeCommand = false;
			}

			command.load(isReload);

			// delete if command won't be loaded again
			if (!command.isBridgeCommand) delete require.cache[require.resolve(file)];
		} else {
			command.isBridgeCommand = true;
			command.load(isReload);

			// delete from chat_bridge/commands
			delete require.cache[require.resolve(file)];

			// delete from src/commands
			const path = Object.keys(require.cache).find(filePath => !filePath.includes('node_modules') && !filePath.includes('functions') && filePath.includes('commands') && filePath.endsWith(`${command.name}.js`));

			if (path) delete require.cache[path];
		}

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
}

module.exports = CommandCollection;
