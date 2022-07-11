import { logger } from '#logger';
import { MinecraftChatManagerState } from '../constants';
import { ChatBridgeEvent } from '../ChatBridgeEvent';

export default class ReadyChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 */
	override run() {
		// stop abort controller
		this.chatBridge.minecraft.clearAbortLoginTimeout();

		// reset relog timeout
		this.chatBridge.minecraft.loginAttempts = 0;

		// set bot to ready
		this.chatBridge.minecraft.state = MinecraftChatManagerState.Ready;

		logger.debug(`[CHATBRIDGE READY]: ${this.chatBridge.logInfo}: spawned and ready`);
	}
}
