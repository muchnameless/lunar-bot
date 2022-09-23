import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';

/**
 * @param reason
 */
export default function run(this: ChatBridge, reason?: string) {
	this.emit(ChatBridgeEvent.Disconnect, reason ?? 'bot end');
}
