import { ChatBridgeEvent } from '../ChatBridge.js';
import { ChatBridgeEvent as BaseChatBridgeEvent } from '../ChatBridgeEvent.js';
import { logger } from '#logger';

export default class ConnectChatBridgeEvent extends BaseChatBridgeEvent {
	/**
	 * event listener callback
	 */
	public override async run() {
		// link chatBridge to the bot account's guild
		void this.chatBridge.link();

		// send bot to limbo (forbidden character in chat)
		let counter = 5;

		do {
			try {
				await this.chatBridge.minecraft.command({
					command: '§',
					prefix: '',
					responseRegExp:
						/^A kick occurred in your connection, so you have been routed to limbo!$|^Illegal characters in chat$|^You were spawned in Limbo\.$|^\/limbo for more information\.$/,
					rejectOnTimeout: true,
					max: 1,
				});

				logger.debug(this.chatBridge.logInfo, '[CHATBRIDGE CONNECT]: sent to limbo');
				break;
			} catch (error) {
				logger.error({ err: error, ...this.chatBridge.logInfo }, '[CHATBRIDGE CONNECT]: error while sending to limbo');
			}
		} while (--counter);

		// bot is in limbo -> won't change servers anymore -> ready to send messages
		this.chatBridge.emit(ChatBridgeEvent.Ready);
	}
}
