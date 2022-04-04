import { clearTimeout } from 'node:timers';
import { logger } from '../../../logger';
import { ChatBridgeEvent, type ChatBridgeEventContext } from '../ChatBridgeEvent';

export default class ReadyChatBridgeEvent extends ChatBridgeEvent {
	constructor(context: ChatBridgeEventContext) {
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
