import { basename } from 'node:path';
import { Collection } from 'discord.js';
import { logger } from '#logger';
import { readJSFiles } from '#functions';
import type { EventEmitter } from 'node:events';
import type { URL } from 'node:url';
import type { BaseEvent } from './BaseEvent';

interface EventLoadOptions {
	/** whether to reload the imported file */
	reload?: boolean;
	/** whether to load disabled events */
	force?: boolean;
}

export class EventCollection extends Collection<string, BaseEvent> {
	/**
	 * NodeJS EventEmitter
	 */
	emitter: EventEmitter;
	/**
	 * path to the event files
	 */
	dirURL: URL;

	constructor(emitter: EventEmitter, dirURL: URL, entries?: readonly [string, BaseEvent][]) {
		super(entries);

		this.emitter = emitter;
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
		const filePath = reload ? `${file}?update=${Date.now()}` : file;

		const Event = (await import(filePath)).default as typeof BaseEvent;
		const event = new Event({
			emitter: this.emitter,
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

		for await (const path of readJSFiles(this.dirURL)) {
			await this.loadFromFile(path, options);

			++eventCount;
		}

		logger.info(`[EVENTS]: ${eventCount} event${eventCount !== 1 ? 's' : ''} loaded`);

		return this;
	}

	/**
	 * unload all commands
	 */
	unloadAll() {
		return this.each((event) => event.unload());
	}
}
