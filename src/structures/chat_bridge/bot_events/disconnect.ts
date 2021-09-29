import { ChatMessage } from '../HypixelMessage';
import type { ChatBridge } from '../ChatBridge';


/**
 * @param chatBridge
 * @param packet
 */
export default function(chatBridge: ChatBridge, { reason }: { reason?: string; }) {
	chatBridge.emit('disconnect', reason && ChatMessage.fromNotch(reason).toString());
}
