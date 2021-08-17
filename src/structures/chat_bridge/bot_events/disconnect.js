import loader from 'prismarine-chat';
import { MC_CLIENT_VERSION } from '../constants/settings.js';
const ChatMessage = loader(MC_CLIENT_VERSION);
import { logger } from '../../../functions/logger.js';


/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 * @param {{ reason?: string }} param1
 */
export default function(chatBridge, { reason }) {
	try {
		chatBridge.emit('disconnect', reason && new ChatMessage(JSON.parse(reason)).toString());
	} catch (error) {
		logger.error(error);

		chatBridge.emit('disconnect', reason);
	}
}
