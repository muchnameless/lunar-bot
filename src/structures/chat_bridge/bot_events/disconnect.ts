import { ChatMessage } from '../HypixelMessage';
import { ChatBridgeEvents } from '../ChatBridge';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 * @param packet
 */
export default function (chatBridge: ChatBridge, { reason }: { reason?: string }) {
	chatBridge.emit(ChatBridgeEvents.DISCONNECT, reason && ChatMessage.fromNotch(reason).toString());
}
