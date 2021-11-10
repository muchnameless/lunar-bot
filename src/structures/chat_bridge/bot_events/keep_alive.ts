import { ChatBridgeEvents } from '../constants';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 */
export default function (chatBridge: ChatBridge) {
	chatBridge.emit(ChatBridgeEvents.READY);
}
