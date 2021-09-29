import type { Response } from 'node-fetch';


export class ImgurAPIError extends Error {
	status: number;
	statusText: string;

	/**
	 * @param response
	 */
	constructor({ status, statusText }: Response) {
		super(statusText);

		this.name = 'ImgurError';
		this.status = status;
		this.statusText = statusText;
	}

	override toString() {
		return `${this.name}${this.status ? ` ${this.status}` : ''}: ${this.message}`;
	}
}
