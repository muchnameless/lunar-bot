import { ChatBridgeEvents } from '#chatBridge/ChatBridge.js';
import { ChatBridgeEvent } from '#chatBridge/ChatBridgeEvent.js';
import { logger } from '#logger';

const limboRegExp = new RegExp(
	[
		/A kick occurred in your connection, so you have been routed to limbo!/,
		/Illegal characters in chat/,
		/You were spawned in Limbo\./,
		/\/limbo for more information\./,
		/{"server":"limbo"}/,
	]
		.map(({ source }) => `^${source}$`)
		.join('|'),
);

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
				// this special string is forbidden and cannot be send as a command, has to be a normal message (not even /ac works)
				const message = '§';
				const timestamp = Date.now();

				this.chatBridge.bot!.write('chat_message', {
					message,
					timestamp,
					salt: 0,
					signature: this.chatBridge.bot!.signMessage(message, BigInt(timestamp)),
				});

				await this.chatBridge.minecraft.command({
					command: 'locraw',
					responseRegExp: limboRegExp,
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
		this.chatBridge.emit(ChatBridgeEvents.Ready);

		// link chatBridge to the bot account's guild
		void this.chatBridge.link();
	}
}
