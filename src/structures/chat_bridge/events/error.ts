import { logger } from '../../../logger';
import { ChatBridgeEvent, type ChatBridgeEventContext } from '../ChatBridgeEvent';

export default class ErrorChatBridgeEvent extends ChatBridgeEvent {
	constructor(context: ChatBridgeEventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

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
