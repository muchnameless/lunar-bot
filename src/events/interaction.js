'use strict';

const { Collection } = require('discord.js');
const ms = require('ms');
const ChatBridgeError = require('../structures/errors/ChatBridgeError');
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

		// command cooldowns
		if (command.cooldown) {
			if	(!client.commands.cooldowns.has(command.name)) client.commands.cooldowns.set(command.name, new Collection());

			const NOW = Date.now();
			const timestamps = client.commands.cooldowns.get(command.name);
			const COOLDOWN_TIME = (command.cooldown ?? client.config.getNumber('COMMAND_COOLDOWN_DEFAULT')) * 1000;

			if (timestamps.has(interaction.user.id)) {
				const expirationTime = timestamps.get(interaction.user.id) + COOLDOWN_TIME;

				if (NOW < expirationTime) {
					const timeLeft = ms(expirationTime - NOW, { long: true });

					logger.info(`[CMD HANDLER]: ${interaction.user.tag}${interaction.guildID ? ` | ${interaction.member.displayName}` : ''} tried to execute '${interaction.commandName}' in ${interaction.guildID ? `#${interaction.channel.name} | ${interaction.guild.name}` : 'DMs'} ${timeLeft} before the cooldown expires`);
					return interaction.reply(`\`${command.name}\` is on cooldown for another \`${timeLeft}\`.`);
				}
			}

			timestamps.set(interaction.user.id, NOW);
			setTimeout(() => timestamps.delete(interaction.user.id), COOLDOWN_TIME);
		}

		logger.info(`[CMD HANDLER]: '${interaction.commandName}' was executed by ${interaction.user.tag}${interaction.guildID ? ` | ${interaction.member.displayName}` : ''} in ${interaction.guildID ? `#${interaction.channel.name} | ${interaction.guild.name}` : 'DMs'}`);

		await command.run(interaction);
	} catch (error) {
		try {
			logger.error(error);
			if (interaction.replied || interaction.deferred) return await interaction.editReply(
				error instanceof ChatBridgeError
					? `${error}`
					: `an error occurred while executing the command: ${error}`,
			);
			await interaction.reply(
				error instanceof ChatBridgeError
					? `${error}`
					: `an error occurred while executing the command: ${error}`,
			);
		} catch (err) {
			logger.error(err);
		}
	}
};
