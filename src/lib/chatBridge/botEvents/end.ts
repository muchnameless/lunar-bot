import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';

/**
 * @param chatBridge
 */
export default function run(chatBridge: ChatBridge, reason?: string) {
	chatBridge.emit(ChatBridgeEvent.Disconnect, reason ?? 'bot end');
}
