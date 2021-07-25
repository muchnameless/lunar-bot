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
		logger.info(`[CMD HANDLER]: '${interaction.logInfo}' was executed by ${interaction.user.tag}${interaction.guildId ? ` | ${interaction.member.displayName}` : ''} in ${interaction.guildId ? `#${interaction.channel.name} | ${interaction.guild.name}` : 'DMs'}`);

		/** @type {import('../structures/commands/SlashCommand')} */
		const command = this.client.commands.get(interaction.commandName);

		if (!command) return interaction.reply({
			content: `${interaction.commandName} is currently disabled`,
			ephemeral: true,
		});

		if (interaction.user.id !== this.client.ownerId) {
			interaction.defer();

			// role permissions
			await command.checkPermissions(interaction);

			// prevent from executing owner only command
			if (command.category === 'owner') {
				return interaction.reply({
					content: `the \`${command.name}\` command is restricted to the bot owner`,
					ephemeral: true,
				});
			}
		}

		// command cooldowns
		if (command.cooldown !== 0) {
			const NOW = Date.now();
			const COOLDOWN_TIME = (command.cooldown ?? this.config.get('COMMAND_COOLDOWN_DEFAULT')) * 1_000;

			if (command.timestamps.has(interaction.user.id)) {
				const EXPIRATION_TIME = command.timestamps.get(interaction.user.id) + COOLDOWN_TIME;

				if (NOW < EXPIRATION_TIME) {
					return interaction.reply({
						content: `\`${command.name}\` is on cooldown for another \`${ms(EXPIRATION_TIME - NOW, { long: true })}\``,
						ephemeral: true,
					});
				}
			}

			command.timestamps.set(interaction.user.id, NOW);
			setTimeout(() => command.timestamps.delete(interaction.user.id), COOLDOWN_TIME);
		}

		return command.run(interaction);
	}

	/**
	 * @param {import('../structures/extensions/ButtonInteraction')} interaction
	 */
	_handleButtonInteraction(interaction) { // eslint-disable-line class-methods-use-this
		// leaderboards edit
		if (interaction.customId.startsWith(LB_KEY)) return handleLeaderboardButtonInteraction(interaction);

		// eval edit
		if (interaction.customId.startsWith('EVAL')) return this.client.commands.get('eval')?.runButton(interaction);
	}

	/**
	 * @param {import('../structures/extensions/SelectMenuInteraction')} interaction
	 */
	_handleSelectMenuInteraction(interaction) { // eslint-disable-line class-methods-use-this
		// leaderboards edit
		if (interaction.customId.startsWith(LB_KEY)) return handleLeaderboardSelectMenuInteraction(interaction);
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').Interaction} interaction
	 */
	async run(interaction) {
		try {
			// commands
			if (interaction.isCommand()) return await this._handleCommandInteraction(interaction);

			// buttons
			if (interaction.isButton()) return await this._handleButtonInteraction(interaction);

			// select menus
			if (interaction.isSelectMenu()) return await this._handleSelectMenuInteraction(interaction);
		} catch (error) {
			logger.error(error);

			if (error.code === Constants.APIErrors.UNKNOWN_INTERACTION || error.code === Constants.APIErrors.INVALID_WEBHOOK_TOKEN) return; // interaction expired

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
};
