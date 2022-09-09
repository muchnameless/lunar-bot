import { basename } from 'node:path';
import { type URL } from 'node:url';
import { Worker, type WorkerOptions } from 'node:worker_threads';
import { logger } from '#logger';

interface Listeners {
	error(err: Error): void;
	exit(exitCode: number): void;
	message(value: any): void;
	messageerror(error: Error): void;
	online(): void;
}

export class Job {
	private _worker: Worker | null = null;

	private readonly _file: URL;

	private readonly _options: WorkerOptions | undefined;

	private readonly _listeners: Listeners;

	private _shouldRestart = true;

	public readonly name: string;

	public constructor(file: URL, options?: WorkerOptions, listeners?: Partial<Listeners>);
	public constructor(file: URL, listeners?: Partial<Listeners>);
	public constructor(file: URL, options?: Partial<Listeners> | WorkerOptions, listeners?: Partial<Listeners>) {
		this._file = file;
		this.name = basename(file.href, '.js');
		this._options = listeners ? (options as WorkerOptions) : undefined;

		const _listeners = listeners ?? (options as Partial<Listeners> | undefined);

		this._listeners = {
			error: _listeners?.error ?? this.onError.bind(this),
			exit: _listeners?.exit ?? this.onExit.bind(this),
			message: _listeners?.message ?? this.onMessage.bind(this),
			messageerror: _listeners?.messageerror ?? this.onMessageerror.bind(this),
			online: _listeners?.online ?? this.onOnline.bind(this),
		};
	}

	public onError(error: Error) {
		logger.error({ err: error, job: this.name }, '[JOB]: error');
	}

	public onExit(code: number) {
		logger.error({ code, job: this.name }, '[JOB]: exited');

		this._worker = null;

		if (this._shouldRestart) this.start();
	}

	public onMessage(message: unknown) {
		logger.info({ job: this.name, message }, '[JOB]: message');
	}

	public onMessageerror(error: Error) {
		logger.error({ err: error, job: this.name }, '[JOB]: messageerror');
	}

	public onOnline() {
		logger.info({ job: this.name }, '[JOB]: worker online');
	}

	public start() {
		if (this._worker) throw new Error(`${this.name}: worker is already running`);

		this._worker = new Worker(this._file, this._options);

		for (const [event, callback] of Object.entries(this._listeners)) {
			this._worker.on(event, callback);
		}
	}

	public async stop(restart = false) {
		if (!this._worker) throw new Error(`${this.name}: worker is not running`);

		this._shouldRestart = restart;
		return this._worker.terminate();
	}

	public postMessage(message: unknown) {
		if (!this._worker) throw new Error(`${this.name}: worker is not running`);

		this._worker.postMessage(message);
	}
}
