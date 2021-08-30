import ms from 'ms';
import { COMMAND_KEY, LB_KEY } from '../constants/index.js';
import { InteractionUtil } from '../util/index.js';
import { handleLeaderboardButtonInteraction, handleLeaderboardSelectMenuInteraction, logger } from '../functions/index.js';
import { Event } from '../structures/events/Event.js';


export default class InteractionCreateEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async #handleCommandInteraction(interaction) {
		if (this.client.chatBridges.channelIds.has(interaction.channelId)) {
			this.client.chatBridges.interactionCache.set(interaction.id, interaction);
			setTimeout(() => this.client.chatBridges.interactionCache.delete(interaction.id), 60_000);
		}

		/** @type {import('../structures/commands/SlashCommand').SlashCommand} */
		const command = this.client.commands.get(interaction.commandName);

		if (!command) return await InteractionUtil.reply(interaction, {
			content: `the \`${interaction.commandName}\` command is currently disabled`,
			ephemeral: true,
		});

		if (interaction.user.id !== this.client.ownerId) {
			// role permissions
			await command.checkPermissions(interaction);

			// prevent from executing owner only command
			if (command.category === 'owner') {
				return await InteractionUtil.reply(interaction, {
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
					return await InteractionUtil.reply(interaction, {
						content: `\`${command.name}\` is on cooldown for another \`${ms(EXPIRATION_TIME - NOW, { long: true })}\``,
						ephemeral: true,
					});
				}
			}

			command.timestamps.set(interaction.user.id, NOW);
			setTimeout(() => command.timestamps.delete(interaction.user.id), COOLDOWN_TIME);
		}

		return await command.runSlash(interaction);
	}

	/**
	 * @param {import('discord.js').ButtonInteraction} interaction
	 */
	async #handleButtonInteraction(interaction) { // eslint-disable-line class-methods-use-this
		const args = interaction.customId.split(':');
		const type = args.shift();

		switch (type) {
			// leaderboards edit
			case LB_KEY:
				return handleLeaderboardButtonInteraction(interaction);

			// command message buttons
			case COMMAND_KEY: {
				const commandName = args.shift();
				/** @type {import('../structures/commands/SlashCommand').SlashCommand} */
				const command = this.client.commands.get(commandName);

				if (!command) {
					if (commandName) await InteractionUtil.reply(interaction, {
						content: `the \`${commandName}\` command is currently disabled`,
						ephemeral: true,
					});

					return;
				}

				if (interaction.user.id !== this.client.ownerId) {
					// role permissions
					await command.checkPermissions(interaction);

					// prevent from executing owner only command
					if (command.category === 'owner') {
						return await InteractionUtil.reply(interaction, {
							content: `the \`${command.name}\` command is restricted to the bot owner`,
							ephemeral: true,
						});
					}
				}

				return await command.runButton(interaction);
			}
		}
	}

	/**
	 * @param {import('discord.js').SelectMenuInteraction} interaction
	 */
	async #handleSelectMenuInteraction(interaction) { // eslint-disable-line class-methods-use-this
		const args = interaction.customId.split(':');
		const type = args.shift();

		switch (type) {
			// leaderboards edit
			case LB_KEY:
				return handleLeaderboardSelectMenuInteraction(interaction);

			// command message buttons
			case 'cmd': {
				const commandName = args.shift();
				/** @type {import('../structures/commands/SlashCommand').SlashCommand} */
				const command = this.client.commands.get(commandName);

				if (!command) {
					if (commandName) await InteractionUtil.reply(interaction, {
						content: `the \`${commandName}\` command is currently disabled`,
						ephemeral: true,
					});

					return;
				}

				if (interaction.user.id !== this.client.ownerId) {
					// role permissions
					await command.checkPermissions(interaction);

					// prevent from executing owner only command
					if (command.category === 'owner') {
						return await InteractionUtil.reply(interaction, {
							content: `the \`${command.name}\` command is restricted to the bot owner`,
							ephemeral: true,
						});
					}
				}

				return await command.runSelect(interaction);
			}
		}
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').Interaction} interaction
	 */
	async run(interaction) {
		// add interaction to the WeakMap which holds InteractionData
		InteractionUtil.add(interaction);

		logger.info(`[INTERACTION CREATE]: ${InteractionUtil.logInfo(interaction)}`);

		try {
			// commands
			if (interaction.isCommand()) return await this.#handleCommandInteraction(interaction);

			// buttons
			if (interaction.isButton()) return await this.#handleButtonInteraction(interaction);

			// select menus
			if (interaction.isSelectMenu()) return await this.#handleSelectMenuInteraction(interaction);
		} catch (error) {
			if (typeof error === 'string') {
				logger.error(`[INTERACTION CREATE]: ${InteractionUtil.logInfo(interaction)}: ${error}`);
			} else {
				logger.error(`[INTERACTION CREATE]: ${InteractionUtil.logInfo(interaction)}`, error);
			}

			if (InteractionUtil.isInteractionError(error)) return; // interaction expired

			try {
				await InteractionUtil.reply(interaction, {
					content: typeof error === 'string'
						? error
						: `an error occurred while executing the command: ${error}`,
					ephemeral: true,
					allowedMentions: { parse: [], repliedUser: true },
				});
			} catch (err) {
				logger.error(err);
			}
		}
	}
}
