import type { HypixelUserMessage } from '../../HypixelMessage.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { BridgeCommand } from '#structures/commands/BridgeCommand.js';

export default class PingBridgeCommand extends BridgeCommand {
	public constructor(context: CommandContext) {
		super(context, {
			aliases: ['o/'],
			description: 'ping the bot',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply('o/');
	}
}
