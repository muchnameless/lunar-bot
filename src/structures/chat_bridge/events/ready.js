import { ChatBridgeEvent } from '../ChatBridgeEvent.js';
import { logger } from '../../../functions/logger.js';


export default class ReadyChatBridgeEvent extends ChatBridgeEvent {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 */
	async run() {
		// stop abort controller
		clearTimeout(this.chatBridge.minecraft.abortLoginTimeout);
		this.chatBridge.minecraft.abortLoginTimeout = null;

		// reset relog timeout
		this.chatBridge.minecraft.loginAttempts = 0;

		// set bot to ready
		this.chatBridge.minecraft.ready = true;

		logger.debug(`[CHATBRIDGE READY]: ${this.chatBridge.logInfo}: spawned and ready`);
	}
}
