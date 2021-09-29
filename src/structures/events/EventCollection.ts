import { Collection } from 'discord.js';
import { basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import readdirp from 'readdirp';
import { logger } from '../../functions';
import type { EventEmitter } from 'node:events';
import type { URL } from 'node:url';
import type { BaseEvent } from './BaseEvent';


interface EventLoadOptions {
	/** wether to reload the imported file */
	reload?: boolean;
	/** wether to load disabled events */
	force?: boolean;
}


export class EventCollection extends Collection<string, BaseEvent> {
	emitter: EventEmitter;
	/**
	 * the path to the commands folder
	 */
	dirURL: URL;

	constructor(emitter: EventEmitter, dirURL: URL, entries?: readonly [ string, BaseEvent ][]) {
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
	static override get [Symbol.species]() {
		return Collection;
	}

	/**
	 * loads a single command into the collection
	 * @param file command file to load
	 * @param options
	 */
	async loadFromFile(file: string, { reload = false, force = false }: EventLoadOptions = {}) {
		const name = basename(file, '.js');

		let filePath = pathToFileURL(file).href;
		if (reload) filePath = `${filePath}?update=${Date.now()}`;

		const Event = (await import(filePath)).default as typeof BaseEvent;
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
	 * @param options
	 */
	async loadAll(options?: EventLoadOptions) {
		let eventCount = 0;

		for await (const { fullPath } of readdirp(fileURLToPath(this.dirURL), {
			fileFilter: [ '*.js', '!~*' ],
		})) {
			await this.loadFromFile(fullPath, options);

			++eventCount;
		}

		logger.info(`[EVENTS]: ${eventCount} event${eventCount !== 1 ? 's' : ''} loaded`);

		return this;
	}

	/**
	 * unload all commands
	 */
	unloadAll() {
		return this.each(event => event.unload());
	}
}
