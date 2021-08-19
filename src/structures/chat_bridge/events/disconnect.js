import { logger } from '../../../functions/index.js';
import { ChatBridgeEvent } from '../ChatBridgeEvent.js';


export default class DisconnectChatBridgeEvent extends ChatBridgeEvent {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {?string} reason
	 */
	async run(reason) {
		this.chatBridge.minecraft.ready = false;

		logger.error(`[CHATBRIDGE DISCONNECT]: Minecraft bot disconnected from server: ${reason ?? 'unknown reason'}`);

		this.chatBridge.minecraft.reconnect();
	}
}
