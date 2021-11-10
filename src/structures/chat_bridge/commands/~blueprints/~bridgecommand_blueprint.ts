import { BridgeCommand } from '../../../commands/BridgeCommand';
import type { CommandContext } from '../../../commands/BaseCommand';
import type { HypixelUserMessage } from '../../HypixelMessage';

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
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	override runMinecraft(hypixelMessage: HypixelUserMessage) {
		// do stuff
	}
}
