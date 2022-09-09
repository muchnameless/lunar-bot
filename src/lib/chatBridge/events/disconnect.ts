import { ChatBridgeEvent } from '../ChatBridgeEvent.js';
import { logger } from '#logger';

export default class DisconnectChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 *
	 * @param reason
	 */
	public override async run(reason: string | null) {
		logger.error({ ...this.chatBridge.logInfo, reason }, '[CHATBRIDGE DISCONNECT]');

		// prevent this event from being emitted multiple times
		this.chatBridge.minecraft.bot?.removeAllListeners('end');

		await this.chatBridge.reconnect();
	}
}
