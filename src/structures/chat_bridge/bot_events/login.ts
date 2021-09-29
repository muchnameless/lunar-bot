import { DEFAULT_SETTINGS } from '../constants';
import { logger } from '../../../functions';
import type { ChatBridge } from '../ChatBridge';


/**
 * @param chatBridge
 */
export default async function(chatBridge: ChatBridge) {
	logger.debug(`[MINECRAFT BOT LOGIN]: ${chatBridge.bot!.username}: logged in`);

	// remove '-' from uuid
	chatBridge.minecraft.botUuid = chatBridge.bot!.uuid.replaceAll('-', '');

	// send settings to server
	chatBridge.bot!.write('settings', DEFAULT_SETTINGS);

	chatBridge.emit('connect');
}
