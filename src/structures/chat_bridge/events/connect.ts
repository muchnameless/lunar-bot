import { logger } from '../../../functions';
import { ChatBridgeEvent } from '../ChatBridgeEvent';
import type { EventContext } from '../../events/BaseEvent';


export default class ConnectChatBridgeEvent extends ChatBridgeEvent {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 */
	override async run() {
		// link chatBridge to the bot account's guild
		this.chatBridge.link();

		// send bot to limbo (forbidden character in chat)
		let counter = 5;

		do {
			try {
				await this.chatBridge.minecraft.command({
					command: 'ac §',
					responseRegExp: /^A kick occurred in your connection, so you have been routed to limbo!$|^Illegal characters in chat$|^You were spawned in Limbo\.$|^\/limbo for more information\.$/,
					rejectOnTimeout: true,
					max: 1,
				});

				logger.debug(`[CHATBRIDGE CONNECT]: ${this.chatBridge.logInfo}: sent to limbo`);
				break;
			} catch (error) {
				logger.error(`[CHATBRIDGE CONNECT]: ${this.chatBridge.logInfo}: error while sending to limbo`, error);
			}
		} while (--counter);
	}
}
