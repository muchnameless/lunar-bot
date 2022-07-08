import { logger } from '../../../logger';
import { ChatBridgeEvent } from '../ChatBridgeEvent';
import { MinecraftChatManagerState } from '../constants';

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
