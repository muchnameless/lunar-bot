import { ChatBridgeEvents } from '#chatBridge/ChatBridge.js';
import { ChatBridgeEvent } from '#chatBridge/ChatBridgeEvent.js';
import { logger } from '#logger';

export default class extends ChatBridgeEvent {
	public override readonly name = ChatBridgeEvents.Connect;

	/**
	 * event listener callback
	 */
	public override async run() {
		// send bot to limbo (forbidden character in chat)
		let counter = 5;

		do {
			try {
				await this.chatBridge.minecraft.sendToLimbo();

				logger.debug(this.chatBridge.logInfo, '[CHATBRIDGE CONNECT]: sent to limbo');
				break;
			} catch (error) {
				logger.error({ err: error, ...this.chatBridge.logInfo }, '[CHATBRIDGE CONNECT]: error while sending to limbo');
			}
		} while (--counter);

		// bot is in limbo -> won't change servers anymore -> ready to send messages
		this.chatBridge.emit(ChatBridgeEvents.Ready);

		// link chatBridge to the bot account's guild
		void this.chatBridge.link();
	}
}
