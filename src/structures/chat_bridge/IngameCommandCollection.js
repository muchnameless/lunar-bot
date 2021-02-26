'use strict';

const { Collection } = require('discord.js');
const { dirname, basename } = require('path');
const IngameCommand = require('./IngameCommand');
const CommandCollection = require('../commands/CommandCollection');
const logger = require('../../functions/logger');


class IngameCommandCollection extends CommandCollection {
	/**
	 * @param {import('../LunarClient')} client
	 * @param {string} dirPath the path to the commands folder
	 * @param {*} entries
	 */
	constructor(chatBridge, dirPath, entries) {
		super(chatBridge.client, dirPath, entries);

		this.chatBridge = chatBridge;
		this.dirPath = dirPath;
		this.aliases = new Map();
	}

	/**
	 * built-in methods will use this as the constructor
	 * that way <CommandCollection>.filter returns a standard Collection
	 */
	static get [Symbol.species]() {
		return Collection;
	}

	/**
	 * loads a single command into the collection
	 * @param {string} file command file to load
	 */
	load(file) {
		const name = basename(file, '.js');
		const category = basename(dirname(file));
		const commandConstructor = require(file);

		if (Object.getPrototypeOf(commandConstructor) !== IngameCommand) throw new Error(`[LOAD COMMAND]: invalid input: ${file}`);

		/**
		 * @type {IngameCommand}
		 */
		const command = new commandConstructor({
			chatBridge: this.chatBridge,
			name,
			category: category !== 'commands' ? category : null,
		});

		command.load();

		delete require.cache[require.resolve(file)];

		return this;
	}
}

module.exports = IngameCommandCollection;
