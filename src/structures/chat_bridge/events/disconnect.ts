import { logger } from '../../../functions';
import { ChatBridgeEvent } from '../ChatBridgeEvent';
import type { EventContext } from '../../events/BaseEvent';

export default class DisconnectChatBridgeEvent extends ChatBridgeEvent {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param reason
	 */
	override run(reason: string | null) {
		this.chatBridge.minecraft.botReady = false;

		logger.error(`[CHATBRIDGE DISCONNECT]: Minecraft bot disconnected from server: ${reason ?? 'unknown reason'}`);

		// prevent this event from being emitted multiple times
		this.chatBridge.minecraft.bot?.removeAllListeners('end');

		this.chatBridge.minecraft.reconnect();
	}
}
