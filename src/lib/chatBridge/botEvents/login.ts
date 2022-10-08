import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';
import { DEFAULT_SETTINGS } from '../constants/index.js';
import { logger } from '#logger';

export default async function run(this: ChatBridge) {
	// uuid can be undefined (despite not being typed as such) in case of network issues
	if (!this.bot?.uuid) {
		logger.error(this.logInfo, '[MINECRAFT BOT LOGIN]: no bot on login event');
		await this.reconnect();
		return;
	}

	// remove '-' from uuid
	this.minecraft.botUuid = this.bot.uuid.replaceAll('-', '');
	this.minecraft.botUsername = this.bot.username;

	logger.debug(this.logInfo, '[MINECRAFT BOT LOGIN]: logged in');

	// send settings to server
	this.bot.write('settings', DEFAULT_SETTINGS);

	this.emit(ChatBridgeEvent.Connect);
}
