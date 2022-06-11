import { clearTimeout } from 'node:timers';
import { logger } from '../../../logger';
import { ChatBridgeEvent } from '../ChatBridgeEvent';

export default class ReadyChatBridgeEvent extends ChatBridgeEvent {
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
