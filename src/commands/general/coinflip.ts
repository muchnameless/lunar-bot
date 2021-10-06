import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionUtil } from '../../util';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class CoinFlipCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('heads, tails or ???'),
			cooldown: 0,
		}, {
			aliases: [ 'cf', 'flip' ],
			args: false,
			usage: '',
		});
	}

	/**
	 * coinflip result
	 */
	// eslint-disable-next-line class-methods-use-this
	#generateReply() {
		const randomNumber = Math.floor(Math.random() * 1_001);

		if (randomNumber === 0) return 'edge';
		if (randomNumber <= 500) return 'heads';
		return 'tails';
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override runSlash(interaction: CommandInteraction) {
		return InteractionUtil.reply(interaction, this.#generateReply());
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override runMinecraft(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(this.#generateReply());
	}
}
