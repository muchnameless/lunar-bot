import { logger } from '#logger';
import { DEFAULT_SETTINGS } from '../constants';
import { ChatBridgeEvent } from '../ChatBridge';
import type { ChatBridge } from '../ChatBridge';

/**
 * @param chatBridge
 */
export default function (chatBridge: ChatBridge) {
	// uuid can be undefined (despite not being typed as such) in case of network issues
	if (!chatBridge.bot?.uuid) {
		logger.error(`[MINECRAFT BOT LOGIN]: ${chatBridge.logInfo}: no bot on login event`);
		return chatBridge.reconnect();
	}

	logger.debug(`[MINECRAFT BOT LOGIN]: ${chatBridge.bot.username}: logged in`);

	// remove '-' from uuid
	chatBridge.minecraft.botUuid = chatBridge.bot.uuid.replaceAll('-', '');

	// send settings to server
	chatBridge.bot.write('settings', DEFAULT_SETTINGS);

	chatBridge.emit(ChatBridgeEvent.Connect);
}
