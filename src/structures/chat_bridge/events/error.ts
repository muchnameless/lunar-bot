import { logger } from '../../../logger';
import { ChatBridgeEvent } from '../ChatBridgeEvent';
import { MinecraftChatManagerState } from '../constants';

export default class ErrorChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 * @param error
	 */
	override run(error: unknown) {
		logger.error(error, '[CHATBRIDGE ERROR]');

		if (error instanceof Error && error.message.includes('Invalid credentials')) {
			this.chatBridge.minecraft.state = MinecraftChatManagerState.Errored;
			this.chatBridge.minecraft.disconnect();

			logger.error('[CHATBRIDGE ERROR]: invalid credentials detected');
		}
	}
}
