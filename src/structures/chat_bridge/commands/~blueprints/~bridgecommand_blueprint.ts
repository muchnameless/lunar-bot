import { BridgeCommand } from '../../../commands/BridgeCommand';
import type { CommandContext } from '../../../commands/BaseCommand';
import type { HypixelMessage } from '../../HypixelMessage';


export default class MyCommand extends BridgeCommand {
	constructor(context: CommandContext) {
		super(context, {
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
	override runMinecraft(hypixelMessage: HypixelMessage<true>) { // eslint-disable-line @typescript-eslint/no-unused-vars
		// do stuff
	}
}
