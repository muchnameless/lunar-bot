import { ChatBridgeEvents } from '../constants';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 * @param error
 */
export default function(chatBridge: ChatBridge, error: unknown) {
	chatBridge.emit(ChatBridgeEvents.ERROR, error);
}
