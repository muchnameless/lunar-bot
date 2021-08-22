import { logger } from '../../../functions/index.js';
import { ChatMessage } from '../HypixelMessage.js';


/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 * @param {{ reason?: string }} param1
 */
export default function(chatBridge, { reason }) {
	try {
		chatBridge.emit('disconnect', reason && ChatMessage.fromNotch(reason).toString());
	} catch (error) {
		logger.error(error);

		chatBridge.emit('disconnect', reason);
	}
}
