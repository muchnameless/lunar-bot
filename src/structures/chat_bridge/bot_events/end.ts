import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 */
export default function(chatBridge: ChatBridge) {
	chatBridge.emit('disconnect', 'bot end');
}
