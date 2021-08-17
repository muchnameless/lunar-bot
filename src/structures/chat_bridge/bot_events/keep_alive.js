// import { logger } from '../../../functions/logger.js';


/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 */
export default function(chatBridge) {
	chatBridge.emit('ready');
}
