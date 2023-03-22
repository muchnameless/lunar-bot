import { ChatBridgeEvents } from '#chatBridge/ChatBridge.js';
import { ChatBridgeEvent } from '#chatBridge/ChatBridgeEvent.js';
import { logger } from '#logger';

export default class DisconnectChatBridgeEvent extends ChatBridgeEvent {
	public override readonly name = ChatBridgeEvents.Disconnect;

	/**
	 * event listener callback
	 *
	 * @param reason
	 */
	public override run(reason: string | null) {
		logger.error({ ...this.chatBridge.logInfo, reason }, '[CHATBRIDGE DISCONNECT]');

		// prevent this event from being emitted multiple times
		this.chatBridge.bot?.removeAllListeners('end');

		void this.chatBridge.reconnect();
	}
}
