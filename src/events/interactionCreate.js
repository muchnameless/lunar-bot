import { Constants } from 'discord.js';
import ms from 'ms';
import { handleLeaderboardButtonInteraction, handleLeaderboardSelectMenuInteraction } from '../functions/leaderboards.js';
import { LB_KEY, AH_KEY } from '../constants/redis.js';
import { InteractionUtil } from '../util/InteractionUtil.js';
import { Event } from '../structures/events/Event.js';
import { logger } from '../functions/logger.js';


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
		logger.info(`[CMD HANDLER]: '${InteractionUtil.logInfo(interaction)}' was executed by ${interaction.user.tag}${interaction.guildId ? ` | ${interaction.member.displayName}` : ''} in ${interaction.guildId ? `#${interaction.channel?.name ?? interaction.channelId} | ${interaction.guild.name}` : 'DMs'}`);

		/** @type {import('../structures/commands/SlashCommand').SlashCommand} */
		const command = this.client.commands.get(interaction.commandName);

		if (!command) return await InteractionUtil.reply(interaction, {
			content: `${interaction.commandName} is currently disabled`,
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

		return command.run(interaction);
	}

	/**
	 * @param {import('discord.js').ButtonInteraction} interaction
	 */
	#handleButtonInteraction(interaction) { // eslint-disable-line class-methods-use-this
		// leaderboards edit
		if (interaction.customId.startsWith(LB_KEY)) return handleLeaderboardButtonInteraction(interaction);

		// eval edit
		if (interaction.customId.startsWith('EVAL')) return this.client.commands.get('eval')?.runButton(interaction);
	}

	/**
	 * @param {import('discord.js').SelectMenuInteraction} interaction
	 */
	#handleSelectMenuInteraction(interaction) { // eslint-disable-line class-methods-use-this
		// leaderboards edit
		if (interaction.customId.startsWith(LB_KEY)) return handleLeaderboardSelectMenuInteraction(interaction);

		// ah profile change
		if (interaction.customId.startsWith(AH_KEY)) return this.client.commands.get('ah')?.runSelect(interaction);
	}

	/**
	 * event listener callback
	 * @param {import('discord.js').Interaction} interaction
	 */
	async run(interaction) {
		// add interaction to the WeakMap which holds InteractionData
		InteractionUtil.add(interaction);

		try {
			// commands
			if (interaction.isCommand()) return await this.#handleCommandInteraction(interaction);

			// buttons
			if (interaction.isButton()) return await this.#handleButtonInteraction(interaction);

			// select menus
			if (interaction.isSelectMenu()) return await this.#handleSelectMenuInteraction(interaction);
		} catch (error) {
			if (typeof error === 'string') {
				logger.error(`[INTERACTION CREATE]: ${interaction.member?.displayName ?? interaction.user.username} | ${interaction.user.tag}: ${InteractionUtil.logInfo(interaction)}: ${error}`);
			} else {
				logger.error(`[INTERACTION CREATE]: ${interaction.member?.displayName ?? interaction.user.username} | ${interaction.user.tag}: ${InteractionUtil.logInfo(interaction)}`, error);
			}

			if (error.code === Constants.APIErrors.UNKNOWN_INTERACTION || error.code === Constants.APIErrors.INVALID_WEBHOOK_TOKEN) return; // interaction expired

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
