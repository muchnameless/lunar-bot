import { ChatBridgeEvents } from '../ChatBridge';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 */
export default function (chatBridge: ChatBridge) {
	chatBridge.emit(ChatBridgeEvents.DISCONNECT, 'bot end');
}
