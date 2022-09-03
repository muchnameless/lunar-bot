import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';
import { DEFAULT_SETTINGS } from '../constants/index.js';
import { logger } from '#logger';

/**
 * @param chatBridge
 */
export default async function run(chatBridge: ChatBridge) {
	// uuid can be undefined (despite not being typed as such) in case of network issues
	if (!chatBridge.bot?.uuid) {
		logger.error(`[MINECRAFT BOT LOGIN]: ${chatBridge.logInfo}: no bot on login event`);
		await chatBridge.reconnect();
		return;
	}

	logger.debug(`[MINECRAFT BOT LOGIN]: ${chatBridge.bot.username}: logged in`);

	// remove '-' from uuid
	chatBridge.minecraft.botUuid = chatBridge.bot.uuid.replaceAll('-', '');

	// send settings to server
	chatBridge.bot.write('settings', DEFAULT_SETTINGS);

	chatBridge.emit(ChatBridgeEvent.Connect);
}
