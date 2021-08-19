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
	 * @param {import('../../HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		return await hypixelMessage.reply('o/');
	}
}
