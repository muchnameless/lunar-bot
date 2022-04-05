import { ChatBridgeEvent } from '../ChatBridge';
import { PrismarineMessage } from '../PrismarineMessage';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 * @param packet
 */
export default function (chatBridge: ChatBridge, { reason }: { reason?: string }) {
	chatBridge.emit(ChatBridgeEvent.Disconnect, reason && PrismarineMessage.fromNotch(reason).toString());
}
