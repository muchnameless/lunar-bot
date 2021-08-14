import { HypixelMessage } from '../HypixelMessage.js';
import { logger } from '../../../functions/logger.js';


/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 * @param {object} packet
 * @param {number} packet.position
 * @param {HypixelMessage.ChatPosition} position
 */
export default async function(chatBridge, { position, message }) {
	try {
		chatBridge.emit('message', await new HypixelMessage(chatBridge, position, JSON.parse(message)).init());
	} catch (error) {
		logger.error('[MINECRAFT BOT CHAT]', error);

		chatBridge.emit('message', await new HypixelMessage(chatBridge, position, message).init());
	}
}
