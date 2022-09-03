import { ChatBridgeEvent } from '../ChatBridgeEvent.js';
import { MinecraftChatManagerState } from '../constants/index.js';
import { logger } from '#logger';

export default class ReadyChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 */
	public override run() {
		// stop abort controller
		this.chatBridge.minecraft.clearAbortLoginTimeout();

		// reset relog timeout
		this.chatBridge.minecraft.loginAttempts = 0;

		// set bot to ready
		this.chatBridge.minecraft.state = MinecraftChatManagerState.Ready;

		logger.debug(`[CHATBRIDGE READY]: ${this.chatBridge.logInfo}: spawned and ready`);
	}
}
