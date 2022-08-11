export class AbortError extends Error {
	constructor(message?: string) {
		super(message ?? 'Request aborted');

		Error.captureStackTrace(this, AbortError);

		this.name = 'AbortError';
	}
}
