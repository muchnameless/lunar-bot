import { BridgeCommand } from '#structures/commands/BridgeCommand';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../HypixelMessage';

export default class MyCommand extends BridgeCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			description: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override minecraftRun(hypixelMessage: HypixelUserMessage) {
		hypixelMessage;
		// do stuff
	}
}
