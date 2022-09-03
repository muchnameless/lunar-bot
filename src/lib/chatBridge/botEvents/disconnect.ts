import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';
import { PrismarineMessage } from '../PrismarineMessage.js';

/**
 * @param chatBridge
 * @param packet
 */
export default function run(chatBridge: ChatBridge, { reason }: { reason?: string }) {
	chatBridge.emit(ChatBridgeEvent.Disconnect, reason && PrismarineMessage.fromNotch(reason).toString());
}
