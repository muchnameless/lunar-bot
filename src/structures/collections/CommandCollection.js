'use strict';

const { Collection } = require('discord.js');
const path = require('path');
const { getAllJsFiles } = require('../../functions/files');
const logger = require('../../functions/logger');


class CommandCollection extends Collection {
	/**
	 * @param {import('../LunarClient')} client
	 * @param {*} entries
	 */
	constructor(client, entries) {
		super(entries);

		this.client = client;
	}

	/**
	 * get a command by name or by alias
	 * @param {string} name
	 * @returns {?import('../Command')}
	 */
	getByName(name) {
		return this.get(name) ?? this.find(cmd => cmd.aliases?.includes(name));
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
		const [, category, name ] = file.match(/[/\\]commands[/\\](\D+)[/\\](\D+)\.js/);
		const commandConstructor = require(file);
		const command = new commandConstructor({
			client: this.client,
			name,
			category,
		});

		this.set(name.toLowerCase(), command);
	}

	/**
	 * loads all commands into the collection
	 */
	loadAll() {
		const commandFiles = getAllJsFiles(path.join(__dirname, '..', '..', 'commands'));

		if (!commandFiles) logger.warn('[COMMANDS]: no command files');

		for (const file of commandFiles) {
			this.load(file);
		}

		logger.debug(`[COMMANDS]: ${commandFiles.length} command${commandFiles.length !== 1 ? 's' : ''} loaded`);
	}
}

module.exports = CommandCollection;
