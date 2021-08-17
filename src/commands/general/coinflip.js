import { DualCommand } from '../../structures/commands/DualCommand.js';
// import { logger } from '../../functions/logger.js';


export default class CoinFlipCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'heads, tails or ???',
				options: [],
				cooldown: 0,
			},
			{
				aliases: [ 'cf', 'flip' ],
				args: false,
				usage: '',
			},
		);
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
	async run(interaction) {
		return await this.reply(interaction, this.#generateReply());
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runInGame(hypixelMessage) {
		return await hypixelMessage.reply(this.#generateReply());
	}
}
