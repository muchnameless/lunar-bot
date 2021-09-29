import type { CommandContext } from '../../../commands/BaseCommand';
import { BridgeCommand } from '../../../commands/BridgeCommand';
import type { HypixelMessage } from '../../HypixelMessage';


export default class PingBridgeCommand extends BridgeCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [ 'o/' ],
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
	override async runMinecraft(hypixelMessage: HypixelMessage) {
		return await hypixelMessage.reply('o/');
	}
}
