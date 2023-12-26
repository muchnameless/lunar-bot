import type { HypixelUserMessage } from '../../HypixelMessage.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { BridgeCommand } from '#structures/commands/BridgeCommand.js';

export default class MyCommand extends BridgeCommand {
	public constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			description: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override minecraftRun(hypixelMessage: HypixelUserMessage) {
		// do stuff
	}
}
