import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';

/**
 * @param chatBridge
 */
export default function run(chatBridge: ChatBridge) {
	chatBridge.emit(ChatBridgeEvent.Ready);
}
