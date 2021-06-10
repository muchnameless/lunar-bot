'use strict';

const ms = require('ms');
const logger = require('./logger');


/**
 * command handler
 * @param {import('../structures/extensions/CommandInteraction')} interaction
 */
module.exports = async (interaction) => {
	const { client } = interaction;

	try {
		/** @type {import('../structures/commands/SlashCommand')} */
		const command = client.commands.get(interaction.commandName);

		if (!command) return;

		if (interaction.user.id !== interaction.client.ownerID) {
			interaction.defer();

			// role permissions
			await command.checkPermissions(interaction);
		} else if (command.category === 'owner') { // prevent from executing owner only command
			logger.info(`[CMD HANDLER]: ${interaction.user.tag}${interaction.guildID ? ` | ${interaction.member.displayName}` : ''} tried to execute '${interaction.logInfo}' in ${interaction.guildID ? `#${interaction.channel.name} | ${interaction.guild.name}` : 'DMs'} which is an owner only command`);
			return await interaction.reply({
				content: `the \`${command.name}\` command is only for the bot owners.`,
				ephemeral: true,
			});
		}

		// command cooldowns
		if (command.cooldown) {
			const NOW = Date.now();
			const COOLDOWN_TIME = (command.cooldown ?? client.config.getNumber('COMMAND_COOLDOWN_DEFAULT')) * 1000;

			if (command.timestamps.has(interaction.user.id)) {
				const EXPIRATION_TIME = command.timestamps.get(interaction.user.id) + COOLDOWN_TIME;

				if (NOW < EXPIRATION_TIME) {
					const TIME_LEFT = ms(EXPIRATION_TIME - NOW, { long: true });

					logger.info(`[CMD HANDLER]: ${interaction.user.tag}${interaction.guildID ? ` | ${interaction.member.displayName}` : ''} tried to execute '${interaction.logInfo}' in ${interaction.guildID ? `#${interaction.channel.name} | ${interaction.guild.name}` : 'DMs'} ${TIME_LEFT} before the cooldown expires`);

					return interaction.reply({
						content: `\`${command.name}\` is on cooldown for another \`${TIME_LEFT}\``,
						ephemeral: true,
					});
				}
			}

			command.timestamps.set(interaction.user.id, NOW);
			setTimeout(() => command.timestamps.delete(interaction.user.id), COOLDOWN_TIME);
		}

		logger.info(`[CMD HANDLER]: '${interaction.logInfo}' was executed by ${interaction.user.tag}${interaction.guildID ? ` | ${interaction.member.displayName}` : ''} in ${interaction.guildID ? `#${interaction.channel.name} | ${interaction.guild.name}` : 'DMs'}`);

		await command.run(interaction);
	} catch (error) {
		logger.error(error);

		try {
			if (typeof error === 'string') {
				await interaction.reply({
					content: `${error}`,
					ephemeral: true,
				});
			} else {
				await interaction.reply({
					content: `an error occurred while executing the command: ${error}`,
					ephemeral: true,
				});
			}
		} catch (err) {
			logger.error(err);
		}
	}
};
