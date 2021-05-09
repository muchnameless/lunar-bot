'use strict';

const logger = require('../functions/logger');


/**
 * error
 * @param {import('../structures/LunarClient')} client
 * @param {import('discord.js').Interaction} interaction
 */
module.exports = async (client, interaction) => {
	// logger.debug({ interaction, options: interaction.options })

	if (!interaction.isCommand()) return;

	try {
		const command = client.slashCommands.get(interaction.commandName);

		if (!command) return;

		await command.run(interaction);
	} catch (error) {
		try {
			logger.error(error);
			if (interaction.replied || interaction.deferred) return await interaction.editReply(`an error occurred while executing the command: ${error}`);
			await interaction.reply(`an error occurred while executing the command: ${error}`);
		} catch (err) {
			logger.error(err);
		}
	}
};
