'use strict';

// const { Constants } = require('discord.js');
const ms = require('ms');
const logger = require('./logger');


/**
 * command handler
 * @param {import('../structures/extensions/CommandInteraction')} interaction
 */
module.exports = async (interaction) => {
	try {
		logger.info(`[CMD HANDLER]: '${interaction.logInfo}' was executed by ${interaction.user.tag}${interaction.guildID ? ` | ${interaction.member.displayName}` : ''} in ${interaction.guildID ? `#${interaction.channel.name} | ${interaction.guild.name}` : 'DMs'}`);

		/** @type {import('../structures/commands/SlashCommand')} */
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) return;

		if (interaction.user.id !== interaction.client.ownerID) {
			interaction.defer();

			// role permissions
			await command.checkPermissions(interaction);

			// prevent from executing owner only command
			if (command.category === 'owner') {
				return await interaction.reply({
					content: `the \`${command.name}\` command is only for the bot owners`,
					ephemeral: true,
				});
			}
		}

		// command cooldowns
		if (command.cooldown) {
			const NOW = Date.now();
			const COOLDOWN_TIME = (command.cooldown ?? interaction.client.config.getNumber('COMMAND_COOLDOWN_DEFAULT')) * 1000;

			if (command.timestamps.has(interaction.user.id)) {
				const EXPIRATION_TIME = command.timestamps.get(interaction.user.id) + COOLDOWN_TIME;

				if (NOW < EXPIRATION_TIME) {
					return await interaction.reply({
						content: `\`${command.name}\` is on cooldown for another \`${ms(EXPIRATION_TIME - NOW, { long: true })}\``,
						ephemeral: true,
					});
				}
			}

			command.timestamps.set(interaction.user.id, NOW);
			setTimeout(() => command.timestamps.delete(interaction.user.id), COOLDOWN_TIME);
		}

		await command.run(interaction);
	} catch (error) {
		logger.error(error);

		if (error.code === 50_027) return; // invalid webhook token, workaround until its in require('discord.js').Constants.APIErrors.INVALID_WEBHOOK_TOKEN

		try {
			await interaction.reply({
				content: typeof error === 'string'
					? error
					: `an error occurred while executing the command: ${error}`,
				ephemeral: true,
			});
		} catch (err) {
			logger.error(err);
		}
	}
};
