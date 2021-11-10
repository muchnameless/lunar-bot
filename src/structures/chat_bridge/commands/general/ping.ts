import { BridgeCommand } from '../../../commands/BridgeCommand';
import type { CommandContext } from '../../../commands/BaseCommand';
import type { HypixelUserMessage } from '../../HypixelMessage';

export default class PingBridgeCommand extends BridgeCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: ['o/'],
			description: 'ping the bot',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override runMinecraft(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply('o/');
	}
}
