import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';

/**
 * @param chatBridge
 * @param error
 */
export default function run(chatBridge: ChatBridge, error: Error) {
	chatBridge.emit(ChatBridgeEvent.Error, error);
}
