export class ImgurAPIError extends Error {
	/**
	 * @param {import('undici').Response} param0
	 */
	constructor({ status, statusText }) {
		super(statusText);

		this.name = 'ImgurError';
		this.status = status;
		this.statusText = statusText;
	}

	toString() {
		return `${this.name}${this.status ? ` ${this.status}` : ''}: ${this.message}`;
	}
}
