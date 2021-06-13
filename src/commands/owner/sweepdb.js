'use strict';

const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class MyCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'deletes unused player db entries',
			options: [],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		const DELETED_AMOUNT = await this.client.players.sweepDb();

		return interaction.reply(`removed \`${DELETED_AMOUNT}\` entr${DELETED_AMOUNT === 1 ? 'y' : 'ies'} from the player database`);
	}
};
