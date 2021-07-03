'use strict';

const { Constants } = require('discord.js');
const ms = require('ms');
const { handleLeaderboardButtonInteraction, handleLeaderboardSelectMenuInteraction } = require('../functions/leaderboards');
const { LB_KEY } = require('../constants/redis');
const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class InteractionCreateEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * @param {import('../structures/extensions/CommandInteraction')} interaction
	 */
	async _handleCommandInteraction(interaction) {
		try {
			logger.info(`[CMD HANDLER]: '${interaction.logInfo}' was executed by ${interaction.user.tag}${interaction.guildID ? ` | ${interaction.member.displayName}` : ''} in ${interaction.guildID ? `#${interaction.channel.name} | ${interaction.guild.name}` : 'DMs'}`);

			/** @type {import('../structures/commands/SlashCommand')} */
			const command = this.client.commands.get(interaction.commandName);

			if (!command) return await interaction.reply({
				content: `${interaction.commandName} is currently disabled`,
				ephemeral: true,
			});

			if (interaction.user.id !== this.client.ownerID) {
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
				const COOLDOWN_TIME = (command.cooldown ?? this.config.get('COMMAND_COOLDOWN_DEFAULT')) * 1000;

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

			if (error.code === Constants.APIErrors.INVALID_WEBHOOK_TOKEN) return; // interaction expired

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
	}

	/**
	 * @param {import('../structures/extensions/ButtonInteraction')} interaction
	 */
	_handleButtonInteraction(interaction) { // eslint-disable-line class-methods-use-this
		// leaderboards edit
		if (interaction.customID.startsWith(LB_KEY)) return handleLeaderboardButtonInteraction(interaction);

		// eval edit
		if (interaction.customID.startsWith('EVAL')) return this.client.commands.get('eval')?.runButton(interaction);
	}

	/**
	 * @param {import('../structures/extensions/SelectMenuInteraction')} interaction
	 */
	_handleSelectMenuInteraction(interaction) { // eslint-disable-line class-methods-use-this
		// leaderboards edit
		if (interaction.customID.startsWith(LB_KEY)) return handleLeaderboardSelectMenuInteraction(interaction);
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').Interaction} interaction
	 */
	async run(interaction) {
		// commands
		if (interaction.isCommand()) return this._handleCommandInteraction(interaction);

		// buttons
		if (interaction.isButton()) return this._handleButtonInteraction(interaction);

		// select menus
		if (interaction.isSelectMenu()) return this._handleSelectMenuInteraction(interaction);
	}
};
