import { type EventEmitter } from 'node:events';
import { basename } from 'node:path';
import { type URL } from 'node:url';
import { Collection } from 'discord.js';
import { type BaseEvent } from './BaseEvent.js';
import { readJSFiles } from '#functions';
import { logger } from '#logger';

interface EventLoadOptions {
	/**
	 * whether to load disabled events
	 */
	force?: boolean;
	/**
	 * whether to reload the imported file
	 */
	reload?: boolean;
}

export class EventCollection extends Collection<string, BaseEvent> {
	/**
	 * NodeJS EventEmitter
	 */
	private readonly emitter: EventEmitter;

	/**
	 * path to the event files
	 */
	public readonly dirURL: URL;

	public constructor(emitter: EventEmitter, dirURL: URL, entries?: readonly [string, BaseEvent][]) {
		super(entries);

		this.emitter = emitter;
		this.dirURL = dirURL;
	}

	/**
	 * built-in methods will use this as the constructor
	 * that way EventCollection#filter returns a standard Collection
	 */
	public static override get [Symbol.species]() {
		return Collection;
	}

	/**
	 * loads a single command into the collection
	 *
	 * @param file - command file to load
	 * @param options
	 * @param options.force - whether to load disabled commands
	 * @param options.reload - whether to reload the imported file
	 */
	public async loadFromFile(file: string, { reload = false, force = false }: EventLoadOptions = {}) {
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
	 *
	 * @param options
	 */
	public async loadAll(options?: EventLoadOptions) {
		let eventCount = 0;

		for await (const path of readJSFiles(this.dirURL)) {
			await this.loadFromFile(path, options);

			++eventCount;
		}

		logger.info({ events: eventCount }, '[EVENTS]: events loaded');

		return this;
	}

	/**
	 * unload all commands
	 */
	public unloadAll() {
		return this.each((event) => event.unload());
	}
}
