import { ChatBridgeEvents } from '../ChatBridge';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 */
export default function (chatBridge: ChatBridge, reason?: string) {
	chatBridge.emit(ChatBridgeEvents.DISCONNECT, reason ?? 'bot end');
}
