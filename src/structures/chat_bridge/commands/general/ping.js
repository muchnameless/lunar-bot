import { BridgeCommand } from '../../../commands/BridgeCommand.js';
// import { logger } from '../../../../functions/logger.js';


export default class PingBridgeCommand extends BridgeCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'o/' ],
			description: 'ping the bot',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage').HypixelMessage} message
	 */
	async runInGame(message) {
		return await message.reply('o/');
	}
}
