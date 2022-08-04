import type { IncomingHttpHeaders } from 'node:http';
import type { Dispatcher, Response } from 'undici';

export class FetchError extends Error {
	type: string | null;
	url: string | null;
	status: number | null;
	statusText: string | null;
	headers: IncomingHttpHeaders;

	/**
	 * @param name error name
	 * @param response fetch response
	 * @param message optional message to overwrite the default (fetch response statusText)
	 */
	constructor(name: string, { statusCode, opaque, context, headers }: Dispatcher.ResponseData, message?: string) {
		super(message ?? statusText);

		this.name = name;
		this.type = type ?? null;
		this.url = url ?? null;
		this.status = statusCode ?? null;
		this.statusText = statusText ?? null;
		this.headers = headers;
	}

	override toString() {
		return `${this.name}${this.status ? ` ${this.status}` : ''}: ${this.message}${
			this.statusText && this.statusText !== this.message && this.statusText !== 'No Content'
				? ` (${this.statusText})`
				: ''
		}`;
	}
}
