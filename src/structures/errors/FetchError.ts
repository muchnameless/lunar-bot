import type { Response } from 'undici';

export class FetchError extends Error {
	type: string | null;
	url: string | null;
	status: number | null;
	statusText: string | null;
	headers: [string, string][];

	/**
	 * @param name error name
	 * @param response fetch response
	 * @param message optional message to overwrite the default (fetch response statusText)
	 */
	constructor(name: string, { type, url, status, statusText, headers }: Partial<Response>, message?: string) {
		super(message ?? statusText);

		this.name = name;
		this.type = type ?? null;
		this.url = url ?? null;
		this.status = status ?? null;
		this.statusText = statusText ?? null;
		this.headers = [...(headers?.entries() ?? [])];
	}

	override toString() {
		return `${this.name}${this.status ? ` ${this.status}` : ''}: ${this.message}${
			this.statusText && this.statusText !== this.message && this.statusText !== 'No Content'
				? ` (${this.statusText})`
				: ''
		}`;
	}
}
