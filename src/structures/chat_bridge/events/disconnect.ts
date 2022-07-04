import { logger } from '../../../logger';
import { ChatBridgeEvent } from '../ChatBridgeEvent';
import { MinecraftChatManagerState } from '../constants';

export default class DisconnectChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * event listener callback
	 * @param reason
	 */
	override async run(reason: string | null) {
		if (this.chatBridge.minecraft.state !== MinecraftChatManagerState.Errored) {
			this.chatBridge.minecraft.state = MinecraftChatManagerState.Connecting;
		}

		logger.error(
			`[CHATBRIDGE DISCONNECT]: ${this.chatBridge.logInfo}: minecraft bot disconnected from server: ${
				reason ?? 'unknown reason'
			}`,
		);

		// prevent this event from being emitted multiple times
		this.chatBridge.minecraft.bot?.removeAllListeners('end');

		await this.chatBridge.minecraft.reconnect();
	}
}
