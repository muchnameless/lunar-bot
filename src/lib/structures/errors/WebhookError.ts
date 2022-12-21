export class WebhookError extends Error {
	/**
	 * @param message
	 */
	public constructor(message: string) {
		super(message);

		this.name = 'WebhookError';
	}
}
