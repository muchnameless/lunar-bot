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

		if (error instanceof Error && /invalid credentials/i.test(error.message)) {
			this.chatBridge.minecraft.state = MinecraftChatManagerState.Errored;
			this.chatBridge.minecraft.disconnect();

			logger.error('[CHATBRIDGE ERROR]: invalid credentials detected');
		}
	}
}
