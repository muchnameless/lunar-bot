import { type Response } from 'undici';

export class FetchError extends Error {
	public readonly type: string | null;

	public readonly url: string | null;

	public readonly status: number | null;

	public readonly statusText: string | null;

	public readonly headers: [string, string][];

	/**
	 * @param name - error name
	 * @param response - fetch response
	 * @param message - optional message to overwrite the default (fetch response statusText)
	 */
	public constructor(name: string, { type, url, status, statusText, headers }: Partial<Response>, message?: string) {
		super(message ?? statusText);

		this.name = name;
		this.type = type ?? null;
		this.url = url ?? null;
		this.status = status ?? null;
		this.statusText = statusText ?? null;
		this.headers = [...(headers?.entries() ?? [])];
	}

	public override toString() {
		return `${this.name}${this.status ? ` ${this.status}` : ''}: ${this.message}${
			this.statusText && this.statusText !== this.message && this.statusText !== 'No Content'
				? ` (${this.statusText})`
				: ''
		}`;
	}
}
