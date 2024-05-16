import type { HypixelUserMessage } from '../../HypixelMessage.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { BridgeCommand } from '#structures/commands/BridgeCommand.js';

export default class CheeseJungleTempleCommand extends BridgeCommand {
	public constructor(context: CommandContext) {
		super(context, {
			aliases: ['cheese'],
			description: 'Doing mental arithmetic is a rare virtue',
			args: 3,
			usage: '[`x`] [`y`] [`z`]',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		// eslint-disable-next-line id-length
		const [x, y, z] = hypixelMessage.commandData.args;

		return hypixelMessage.reply(`${Number(x) + 61} ${Number(y) - 44} ${Number(z) + 18}`);
	}
}
