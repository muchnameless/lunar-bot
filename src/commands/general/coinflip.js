import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
// import { logger } from '../../functions/logger.js';


export default class CoinFlipCommand extends DualCommand {
	constructor(context) {
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
		const randomNumber = Math.floor(Math.random() * 1001);

		if (randomNumber === 0) return 'edge';
		if (randomNumber <= 500) return 'heads';
		return 'tails';
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		return await InteractionUtil.reply(interaction, this.#generateReply());
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		return await hypixelMessage.reply(this.#generateReply());
	}
}
