import { logger } from '../../../logger';
import { ChatBridgeEvent } from '../ChatBridgeEvent';

export default class ErrorChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 * @param error
	 */
	override run(error: Error) {
		logger.error(error, '[CHATBRIDGE ERROR]');

		if (error.message.includes('Invalid credentials')) {
			this.chatBridge.minecraft.shouldReconnect = false;
			this.chatBridge.minecraft.disconnect();

			logger.error('[CHATBRIDGE ERROR]: invalid credentials detected');
		}
	}
}
