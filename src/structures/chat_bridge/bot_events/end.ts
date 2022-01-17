import { ChatBridgeEvent } from '../ChatBridge';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 */
export default function (chatBridge: ChatBridge, reason?: string) {
	chatBridge.emit(ChatBridgeEvent.Disconnect, reason ?? 'bot end');
}
