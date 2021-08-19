import { BridgeCommand } from '../../../commands/BridgeCommand.js';
// import logger from '../../../../functions/logger.js';


export default class MyCommand extends BridgeCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: '',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) { // eslint-disable-line no-unused-vars
		// do stuff
	}
}
