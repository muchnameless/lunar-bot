import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 * @param error
 */
export default function(chatBridge: ChatBridge, error: unknown) {
	chatBridge.emit('error', error);
}
