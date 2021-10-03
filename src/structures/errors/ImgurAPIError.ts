import type { Response } from 'node-fetch';


export class ImgurAPIError extends Error {
	type: string;
	url: string;
	status: number;
	statusText: string;
	headers: Headers;

	/**
	 * @param response
	 */
	constructor({ type, url, status, statusText, headers }: Response) {
		super(statusText);

		this.name = 'ImgurError';
		this.type = type;
		this.url = url;
		this.status = status;
		this.statusText = statusText;
		this.headers = headers;
	}

	override toString() {
		return `${this.name}${this.status ? ` ${this.status}` : ''}: ${this.message}`;
	}
}
