import { ChatBridgeEvent } from '../ChatBridgeEvent.js';
import { logger } from '#logger';

export default class DisconnectChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 *
	 * @param reason
	 */
	public override async run(reason: string | null) {
		logger.error(
			`[CHATBRIDGE DISCONNECT]: ${this.chatBridge.logInfo}: minecraft bot disconnected from server: ${
				reason ?? 'unknown reason'
			}`,
		);

		// prevent this event from being emitted multiple times
		this.chatBridge.minecraft.bot?.removeAllListeners('end');

		await this.chatBridge.reconnect();
	}
}
