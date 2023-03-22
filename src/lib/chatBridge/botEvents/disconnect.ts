import { ChatBridgeEvents, type ChatBridge } from '../ChatBridge.js';
import { PrismarineMessage } from '../PrismarineMessage.js';

/**
 * @param packet
 */
export default function run(this: ChatBridge, { reason }: { reason?: string }) {
	this.emit(ChatBridgeEvents.Disconnect, reason && PrismarineMessage.fromNotch(reason).toString());
}
