import { logger } from '#logger';
import { MinecraftChatManagerState } from '../constants';
import { ChatBridgeEvent } from '../ChatBridgeEvent';

export default class ErrorChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 * @param error
	 */
	override run(error: unknown) {
		logger.error(error, '[CHATBRIDGE ERROR]');

		if (error instanceof Error) {
			// handle login errors
			if (error.message.startsWith('Failed to obtain profile data')) {
				void this.chatBridge.minecraft.reconnect();
			} else if (error.message.startsWith('Invalid credentials')) {
				this.chatBridge.minecraft.state = MinecraftChatManagerState.Errored;
				this.chatBridge.minecraft.disconnect();

				logger.error('[CHATBRIDGE ERROR]: invalid credentials detected');
			}
		}
	}
}
