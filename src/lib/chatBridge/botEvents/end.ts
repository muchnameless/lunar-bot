import { ChatBridgeEvents, type ChatBridge } from '../ChatBridge.js';

/**
 * @param reason
 */
export default function run(this: ChatBridge, reason?: string) {
	this.emit(ChatBridgeEvents.Disconnect, reason ?? 'bot end');
}
