'use strict';

const DualCommand = require('../../structures/commands/DualCommand');
// const logger = require('../../functions/logger');


module.exports = class CoinFlipCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'heads, tails or ???',
				options: [],
				defaultPermission: true,
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
	_generateReply() {
		const randomNumber = Math.floor(Math.random() * 1001);

		if (randomNumber === 0) return 'edge';
		if (randomNumber <= 500) return 'heads';
		return 'tails';
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		return interaction.reply(this._generateReply());
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message
	 */
	async runInGame(message) {
		return message.reply(this._generateReply());
	}
};
