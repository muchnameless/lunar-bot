import { DEFAULT_SETTINGS } from '../constants/index.js';
import { logger } from '../../../functions/index.js';


/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 */
export default async function(chatBridge) {
	logger.debug(`[MINECRAFT BOT LOGIN]: ${chatBridge.bot.username}: logged in`);

	// remove '-' from uuid
	chatBridge.minecraft.botUuid = chatBridge.bot.uuid.replaceAll('-', '');

	// send settings to server
	chatBridge.bot.write('settings', DEFAULT_SETTINGS);

	chatBridge.emit('connect');
}
