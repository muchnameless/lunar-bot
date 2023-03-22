import { ChatBridgeEvents } from '#chatBridge/ChatBridge.js';
import { ChatBridgeEvent } from '#chatBridge/ChatBridgeEvent.js';
import { MinecraftChatManagerState } from '#chatBridge/managers/MinecraftChatManager.js';
import { logger } from '#logger';

export default class extends ChatBridgeEvent {
	public override readonly name = ChatBridgeEvents.Ready;

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

		logger.debug(this.chatBridge.logInfo, '[CHATBRIDGE READY]: spawned and ready');
	}
}
