import { defaultSettings } from '../constants/settings.js';
import { logger } from '../../../functions/logger.js';


/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 */
export default async function(chatBridge) {
	logger.debug(`[MINECRAFT BOT LOGIN]: ${chatBridge.bot.username}: logged in`);

	// remove '-' from uuid
	chatBridge.minecraft.botUuid = chatBridge.bot.uuid.replaceAll('-', '');

	// send settings to server
	chatBridge.bot.write('settings', defaultSettings);

	chatBridge.emit('connect');
}
