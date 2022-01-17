import { DEFAULT_SETTINGS } from '../constants';
import { logger } from '../../../functions';
import { ChatBridgeEvent } from '../ChatBridge';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 */
export default function (chatBridge: ChatBridge) {
	if (!chatBridge.bot) return logger.error(`${chatBridge.logInfo}: no bot on login event`);

	logger.debug(`[MINECRAFT BOT LOGIN]: ${chatBridge.bot.username}: logged in`);

	// remove '-' from uuid
	chatBridge.minecraft.botUuid = chatBridge.bot.uuid.replaceAll('-', '');

	// send settings to server
	chatBridge.bot.write('settings', DEFAULT_SETTINGS);

	chatBridge.emit(ChatBridgeEvent.Connect);
}
