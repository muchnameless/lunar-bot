import type { IncomingHttpHeaders } from 'node:http';
import type { Dispatcher } from 'undici';

export class FetchError extends Error {
	status: number | null;
	statusText: string | null;
	headers: IncomingHttpHeaders | null;

	/**
	 * @param name error name
	 * @param response fetch response
	 * @param message optional message to overwrite the default (fetch response statusText)
	 */
	constructor(
		name: string,
		{ statusCode, statusMessage, headers }: Partial<Dispatcher.ResponseData>,
		message?: string,
	) {
		super(message ?? statusMessage);

		this.name = name;
		this.status = statusCode ?? null;
		this.statusText = statusMessage ?? null;
		this.headers = headers ?? null;
	}

	override toString() {
		return `${this.name}${this.status ? ` ${this.status}` : ''}: ${this.message}${
			this.statusText && this.statusText !== this.message && this.statusText !== 'No Content'
				? ` (${this.statusText})`
				: ''
		}`;
	}
}
