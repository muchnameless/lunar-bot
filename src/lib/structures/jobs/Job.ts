import { Worker } from 'node:worker_threads';
import { basename } from 'node:path';
import { logger } from '#logger';
import type { WorkerOptions } from 'node:worker_threads';
import type { URL } from 'node:url';

interface Listeners {
	error: (err: Error) => void;
	exit: (exitCode: number) => void;
	message: (value: any) => void;
	messageerror: (error: Error) => void;
	online: () => void;
}

export class Job {
	private _worker: Worker | null = null;
	private _file: URL;
	private _options: WorkerOptions | undefined;
	private _listeners: Listeners;
	private _shouldRestart = true;

	name: string;

	constructor(file: URL, options?: WorkerOptions, listeners?: Partial<Listeners>);
	constructor(file: URL, listeners?: Partial<Listeners>);
	constructor(file: URL, options?: WorkerOptions | Partial<Listeners>, listeners?: Partial<Listeners>) {
		this._file = file;
		this.name = basename(file.href, '.js');
		this._options = listeners ? (options as WorkerOptions) : undefined;

		const _listeners = listeners ?? (options as Partial<Listeners>);

		this._listeners = {
			error: _listeners?.error ?? this.onError.bind(this),
			exit: _listeners?.exit ?? this.onExit.bind(this),
			message: _listeners?.message ?? this.onMessage.bind(this),
			messageerror: _listeners?.messageerror ?? this.onMessageerror.bind(this),
			online: _listeners?.online ?? this.onOnline.bind(this),
		};
	}

	onError(error: Error) {
		logger.error(error, `[JOB] ${this.name}: error`);
	}

	onExit(code: number) {
		logger.error(`[JOB] ${this.name}: exited with code ${code}`);

		this._worker = null;

		if (this._shouldRestart) this.start();
	}

	onMessage(message: unknown) {
		if (typeof message === 'string') {
			logger.info(message);
		} else {
			logger.info(message, `[JOB] ${this.name}: message`);
		}
	}

	onMessageerror(error: Error) {
		logger.error(error, `[JOB] ${this.name}: messageerror`);
	}

	onOnline() {
		logger.info(`[JOB] ${this.name}: worker online`);
	}

	start() {
		if (this._worker) throw new Error(`${this.name}: worker is already running`);

		this._worker = new Worker(this._file, this._options);

		for (const [event, callback] of Object.entries(this._listeners)) {
			this._worker.on(event, callback);
		}
	}

	stop(restart = false) {
		if (!this._worker) throw new Error(`${this.name}: worker is not running`);

		this._shouldRestart = restart;
		return this._worker.terminate();
	}

	postMessage(message: unknown) {
		if (!this._worker) throw new Error(`${this.name}: worker is not running`);

		this._worker.postMessage(message);
	}
}
