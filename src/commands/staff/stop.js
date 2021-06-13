'use strict';

const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class StopCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'stop the bot. It should restart immediatly',
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
		try {
			await interaction.reply('stopping the bot');
		} catch (error) {
			logger.error(error);
		} finally {
			this.client.exit();
		}
	}
};
