import { logger } from '../../../functions';
import { ChatBridgeEvent } from '../ChatBridgeEvent';
import type { EventContext } from '../../events/BaseEvent';

export default class ReadyChatBridgeEvent extends ChatBridgeEvent {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 */
	override run() {
		// stop abort controller
		clearTimeout(this.chatBridge.minecraft.abortLoginTimeout!);
		this.chatBridge.minecraft.abortLoginTimeout = null;

		// reset relog timeout
		this.chatBridge.minecraft.loginAttempts = 0;

		// set bot to ready
		this.chatBridge.minecraft.botReady = true;

		logger.debug(`[CHATBRIDGE READY]: ${this.chatBridge.logInfo}: spawned and ready`);
	}
}
