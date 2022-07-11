import { BridgeCommand } from '#structures/commands/BridgeCommand';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../HypixelMessage';

export default class PingBridgeCommand extends BridgeCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: ['o/'],
			description: 'ping the bot',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply('o/');
	}
}
