import { Collection } from 'discord.js';
import { basename } from 'path';
import { pathToFileURL } from 'url';
import { getAllJsFiles, logger } from '../../functions/index.js';

/**
 * @typedef {object} EventLoadOptions
 * @property {boolean} [reload=false] wether to reload the imported file
 * @property {boolean} [force=false] wether to load disabled events
 */


export class EventCollection extends Collection {
	/**
	 * @param {import('events').EventEmitter} emitter
	 * @param {URL} dirURL the path to the commands folder
	 * @param {*} [entries]
	 */
	constructor(emitter, dirURL, entries) {
		super(entries);

		/**
		 * NodeJS EventEmitter
		 */
		this.emitter = emitter;
		/**
		 * path to the event files
		 */
		this.dirURL = dirURL;
	}

	/**
	 * built-in methods will use this as the constructor
	 * that way EventCollection#filter returns a standard Collection
	 */
	static get [Symbol.species]() {
		return Collection;
	}

	/**
	 * loads a single command into the collection
	 * @param {string} file command file to load
	 * @param {EventLoadOptions} [options]
	 */
	async loadFromFile(file, { reload = false, force = false } = {}) {
		const name = basename(file, '.js');

		let filePath = pathToFileURL(file).href;
		if (reload) filePath = `${filePath}?update=${Date.now()}`;

		const Event = (await import(filePath)).default;
		/** @type {import('./BaseEvent').BaseEvent} */
		const event = new Event({
			emitter: this.emitter,
			collection: this,
			name,
		});

		this.set(name, event);

		event.load(force);

		return event;
	}

	/**
	 * loads all commands into the collection
	 * @param {EventLoadOptions} [options]
	 */
	async loadAll(options) {
		const eventFiles = await getAllJsFiles(this.dirURL);

		await Promise.all(eventFiles.map(file => this.loadFromFile(file, options)));

		logger.info(`[EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);

		return this;
	}

	/**
	 * unload all commands
	 */
	unloadAll() {
		return this.each(event => event.unload());
	}
}
