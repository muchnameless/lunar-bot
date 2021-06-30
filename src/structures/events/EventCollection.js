'use strict';

const { Collection } = require('discord.js');
const { basename } = require('path');
const { getAllJsFiles } = require('../../functions/files');
const logger = require('../../functions/logger');


module.exports = class EventCollection extends Collection {
	/**
	 * @param {import('../LunarClient')} client
	 * @param {string} dirPath the path to the commands folder
	 * @param {*} [entries]
	 */
	constructor(client, dirPath, entries) {
		super(entries);

		this.client = client;
		/**
		 * path to the event files
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
	 * @param {string} file command file to load
	 * @param {boolean} [force=false] wether to also load disabled events
	 */
	loadFromFile(file, force = false) {
		const name = basename(file, '.js');
		const Event = require(file);
		/** @type {import('./Event')} */
		const event = new Event({
			client: this.client,
			collection: this,
			name,
		});

		this.set(name, event);

		event.load(force);

		// delete if command won't be loaded again
		delete require.cache[require.resolve(file)];

		return event;
	}

	/**
	 * loads all commands into the collection
	 */
	async loadAll() {
		const eventFiles = await getAllJsFiles(this.dirPath);

		for (const file of eventFiles) {
			this.loadFromFile(file);
		}

		logger.debug(`[EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);

		return this;
	}

	/**
	 * unload all commands
	 */
	unloadAll() {
		return this.each(event => event.unload());
	}
};
