import { ChatMessage } from '../HypixelMessage.js';


/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 * @param {{ reason?: string }} param1
 */
export default function(chatBridge, { reason }) {
	chatBridge.emit('disconnect', reason && ChatMessage.fromNotch(reason).toString());
}
