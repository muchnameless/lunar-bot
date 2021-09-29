import { BridgeCommand } from '../../../commands/BridgeCommand';
import type { HypixelMessage } from '../../HypixelMessage';


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
	 * @param hypixelMessage
	 */
	async runMinecraft(hypixelMessage: HypixelMessage) { // eslint-disable-line @typescript-eslint/no-unused-vars
		// do stuff
	}
}
