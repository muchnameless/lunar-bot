// import { logger } from '#logger';
import { ChatBridgeEvent } from '../ChatBridgeEvent';

export default class ConnectChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 */
	override /* async */ run() {
		// link chatBridge to the bot account's guild
		void this.chatBridge.link();

		// send bot to limbo (forbidden character in chat)
		// let counter = 5;

		// do {
		// 	try {
		// 		// TODO: fix, hypixel broke it
		// 		await this.chatBridge.minecraft.command({
		// 			command: 'ac §',
		// 			responseRegExp:
		// 				/^A kick occurred in your connection, so you have been routed to limbo!$|^Illegal characters in chat$|^You were spawned in Limbo\.$|^\/limbo for more information\.$/,
		// 			rejectOnTimeout: true,
		// 			max: 1,
		// 		});

		// 		logger.debug(`[CHATBRIDGE CONNECT]: ${this.chatBridge.logInfo}: sent to limbo`);
		// 		break;
		// 	} catch (error) {
		// 		logger.error(error, `[CHATBRIDGE CONNECT]: ${this.chatBridge.logInfo}: error while sending to limbo`);
		// 	}
		// } while (--counter);
	}
}
