import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';

/**
 * @param error
 */
export default function run(this: ChatBridge, error: Error) {
	this.emit(ChatBridgeEvent.Error, error);
}
