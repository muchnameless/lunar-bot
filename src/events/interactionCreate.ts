import ms from 'ms';
import { COMMAND_KEY, LB_KEY } from '../constants';
import { InteractionUtil } from '../util';
import {
	handleLeaderboardButtonInteraction,
	handleLeaderboardSelectMenuInteraction,
	logger,
	minutes,
} from '../functions';
import { Event } from '../structures/events/Event';
import type {
	BaseGuildTextChannel,
	ButtonInteraction,
	CommandInteraction,
	ContextMenuInteraction,
	GuildMember,
	Message,
	SelectMenuInteraction,
} from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';
import type { ChatInteraction } from '../util/InteractionUtil';

export default class InteractionCreateEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * @param interaction
	 */
	async #handleCommandInteraction(interaction: CommandInteraction) {
		logger.info(
			{
				type: interaction.type,
				command: interaction.toString(),
				user: interaction.member
					? `${(interaction.member as GuildMember).displayName} | ${interaction.user.tag}`
					: interaction.user.tag,
				channel: interaction.guildId
					? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
					: 'DM',
			},
			'INTERACTION_CREATE',
		);

		if (this.client.chatBridges.channelIds.has(interaction.channelId)) {
			this.client.chatBridges.interactionCache.set(interaction.id, interaction);
			setTimeout(() => this.client.chatBridges.interactionCache.delete(interaction.id), minutes(1));
		}

		const command = this.client.commands.get(interaction.commandName);

		if (!command) {
			return InteractionUtil.reply(interaction, {
				content: `the \`${interaction.commandName}\` command is currently disabled`,
				ephemeral: true,
			});
		}

		if (interaction.user.id !== this.client.ownerId) {
			// role permissions
			await command.checkPermissions(interaction);

			// prevent from executing owner only command
			if (command.category === 'owner') {
				return InteractionUtil.reply(interaction, {
					content: `the \`${command.name}\` command is restricted to the bot owner`,
					ephemeral: true,
				});
			}
		}

		// command cooldowns
		if (command.timestamps) {
			const NOW = Date.now();
			const COOLDOWN_TIME = command.cooldown ?? this.config.get('COMMAND_COOLDOWN_DEFAULT');

			if (command.timestamps.has(interaction.user.id)) {
				const EXPIRATION_TIME = command.timestamps.get(interaction.user.id)! + COOLDOWN_TIME;

				if (NOW < EXPIRATION_TIME) {
					return InteractionUtil.reply(interaction, {
						content: `\`${command.name}\` is on cooldown for another \`${ms(EXPIRATION_TIME - NOW, { long: true })}\``,
						ephemeral: true,
					});
				}
			}

			command.timestamps.set(interaction.user.id, NOW);
			setTimeout(() => command.timestamps!.delete(interaction.user.id), COOLDOWN_TIME);
		}

		return command.runSlash(interaction);
	}

	/**
	 * @param interaction
	 */
	async #handleButtonInteraction(interaction: ButtonInteraction) {
		logger.info(
			{
				type: interaction.componentType,
				customId: interaction.customId,
				user: interaction.member
					? `${(interaction.member as GuildMember).displayName} | ${interaction.user.tag}`
					: interaction.user.tag,
				channel: interaction.guildId
					? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
					: 'DM',
			},
			'INTERACTION_CREATE',
		);

		const args = interaction.customId.split(':');
		const type = args.shift();

		switch (type) {
			// leaderboards edit
			case LB_KEY:
				return handleLeaderboardButtonInteraction(interaction, args);

			// command message buttons
			case COMMAND_KEY: {
				const commandName = args.shift();
				const command = this.client.commands.get(commandName!);

				if (!command) {
					if (commandName) {
						await InteractionUtil.reply(interaction, {
							content: `the \`${commandName}\` command is currently disabled`,
							ephemeral: true,
						});
					}

					return;
				}

				if (interaction.user.id !== this.client.ownerId) {
					// role permissions
					await command.checkPermissions(interaction);

					// prevent from executing owner only command
					if (command.category === 'owner') {
						return InteractionUtil.reply(interaction, {
							content: `the \`${command.name}\` command is restricted to the bot owner`,
							ephemeral: true,
						});
					}
				}

				return command.runButton(interaction, args);
			}
		}
	}

	/**
	 * @param interaction
	 */
	async #handleSelectMenuInteraction(interaction: SelectMenuInteraction) {
		logger.info(
			{
				type: interaction.componentType,
				customId: interaction.customId,
				values: interaction.values,
				user: interaction.member
					? `${(interaction.member as GuildMember).displayName} | ${interaction.user.tag}`
					: interaction.user.tag,
				channel: interaction.guildId
					? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
					: 'DM',
			},
			'INTERACTION_CREATE',
		);

		const args = interaction.customId.split(':');
		const type = args.shift();

		switch (type) {
			// leaderboards edit
			case LB_KEY:
				return handleLeaderboardSelectMenuInteraction(interaction, args);

			// command message buttons
			case 'cmd': {
				const commandName = args.shift();
				const command = this.client.commands.get(commandName!);

				if (!command) {
					if (commandName) {
						await InteractionUtil.reply(interaction, {
							content: `the \`${commandName}\` command is currently disabled`,
							ephemeral: true,
						});
					}

					return;
				}

				if (interaction.user.id !== this.client.ownerId) {
					// role permissions
					await command.checkPermissions(interaction);

					// prevent from executing owner only command
					if (command.category === 'owner') {
						return InteractionUtil.reply(interaction, {
							content: `the \`${command.name}\` command is restricted to the bot owner`,
							ephemeral: true,
						});
					}
				}

				return command.runSelect(interaction, args);
			}
		}
	}

	/**
	 * @param interaction
	 */
	async #handleContextMenuInteraction(interaction: ContextMenuInteraction) {
		logger.info(
			{
				type: interaction.targetType,
				command: interaction.commandName,
				user: interaction.member
					? `${(interaction.member as GuildMember).displayName} | ${interaction.user.tag}`
					: interaction.user.tag,
				channel: interaction.guildId
					? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
					: 'DM',
			},
			'INTERACTION_CREATE',
		);

		const command = this.client.commands.get(interaction.commandName);

		if (!command) {
			return InteractionUtil.reply(interaction, {
				content: `the \`${interaction.commandName}\` command is currently disabled`,
				ephemeral: true,
			});
		}

		if (interaction.user.id !== this.client.ownerId) {
			// role permissions
			await command.checkPermissions(interaction);

			// prevent from executing owner only command
			if (command.category === 'owner') {
				return InteractionUtil.reply(interaction, {
					content: `the \`${command.name}\` command is restricted to the bot owner`,
					ephemeral: true,
				});
			}
		}

		switch (interaction.targetType) {
			case 'MESSAGE':
				return command.runMessage(interaction, interaction.options.getMessage('message') as Message);

			case 'USER': {
				const { user, member } = interaction.options.get('user')!;
				return command.runUser(interaction, user!, (member as GuildMember) ?? null);
			}

			default:
				logger.error(`[HANDLE CONTEXT MENU]: unknown target type: ${interaction.targetType}`);
		}
	}

	/**
	 * event listener callback
	 * @param interaction
	 */
	override async run(interaction: ChatInteraction) {
		// add interaction to the WeakMap which holds InteractionData
		InteractionUtil.add(interaction);

		try {
			// commands
			if (interaction.isCommand()) return await this.#handleCommandInteraction(interaction);

			// buttons
			if (interaction.isButton()) return await this.#handleButtonInteraction(interaction);

			// select menus
			if (interaction.isSelectMenu()) return await this.#handleSelectMenuInteraction(interaction);

			// context menu
			if (interaction.isContextMenu()) return await this.#handleContextMenuInteraction(interaction);

			return InteractionUtil.reply(interaction, {
				content: `unknown interaction type '${interaction.type}'`,
				ephemeral: true,
			});
		} catch (error) {
			if (typeof error === 'string') {
				logger.error(`[INTERACTION CREATE]: ${InteractionUtil.logInfo(interaction)}: ${error}`);
			} else {
				logger.error(error, `[INTERACTION CREATE]: ${InteractionUtil.logInfo(interaction)}`);
			}

			if (InteractionUtil.isInteractionError(error)) return; // interaction expired

			InteractionUtil.reply(interaction, {
				content: typeof error === 'string' ? error : `an error occurred while executing the command: ${error}`,
				ephemeral: true,
				allowedMentions: { parse: [], repliedUser: true },
			});
		}
	}
}
