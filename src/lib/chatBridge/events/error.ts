import { ChatBridgeEvent } from '../ChatBridgeEvent.js';
import { logger } from '#logger';

export default class ErrorChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 *
	 * @param error
	 */
	public override run(error: unknown) {
		logger.error({ err: error, ...this.chatBridge.logInfo }, '[CHATBRIDGE ERROR]');

		if (error instanceof Error) {
			// handle login errors
			if (error.message.startsWith('Failed to obtain profile data')) {
				void this.chatBridge.minecraft.reconnect();
			} else if (error.message.startsWith('Invalid credentials')) {
				this.chatBridge.minecraft.disconnect(true);

				logger.error(this.chatBridge.logInfo, '[CHATBRIDGE ERROR]: invalid credentials detected');
			} else if (
				error.message.startsWith('Failed to authenticate your connection') &&
				this.chatBridge.minecraft.loginAttempts >= 10
			) {
				this.chatBridge.minecraft.disconnect(true);

				logger.error(
					this.chatBridge.logInfo,
					`[CHATBRIDGE ERROR]: failed to authenticate ${this.chatBridge.minecraft.loginAttempts} times`,
				);
			}
		}
	}
}
