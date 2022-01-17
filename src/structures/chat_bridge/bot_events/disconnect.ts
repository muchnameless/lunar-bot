import { ChatMessage } from '../HypixelMessage';
import { ChatBridgeEvent } from '../ChatBridge';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 * @param packet
 */
export default function (chatBridge: ChatBridge, { reason }: { reason?: string }) {
	chatBridge.emit(ChatBridgeEvent.Disconnect, reason && ChatMessage.fromNotch(reason).toString());
}
