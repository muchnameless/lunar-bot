import { setTimeout } from 'node:timers';
import { ApplicationCommandOptionLimits } from '@sapphire/discord-utilities';
import {
	ActionRowBuilder,
	ApplicationCommandType,
	ChannelType,
	ComponentType,
	Events,
	InteractionType,
	PermissionFlagsBits,
	userMention,
	type APIActionRowComponent,
	type APIMessageActionRowComponent,
	type ApplicationCommandOptionChoiceData,
	type AutocompleteInteraction,
	type ButtonInteraction,
	type ChannelSelectMenuInteraction,
	type ChatInputCommandInteraction,
	type ClientEvents,
	type JSONEncodable,
	type MentionableSelectMenuInteraction,
	type MessageActionRowComponentBuilder,
	type MessageContextMenuCommandInteraction,
	type ModalSubmitInteraction,
	type RoleSelectMenuInteraction,
	type Snowflake,
	type StringSelectMenuInteraction,
	type UserContextMenuCommandInteraction,
	type UserSelectMenuInteraction,
} from 'discord.js';
import ms from 'ms';
import { CustomIdKey, GUILD_ID_ALL } from '#constants';
import {
	assertNever,
	handleLeaderboardButtonInteraction,
	handleLeaderboardSelectMenuInteraction,
	sortCache,
} from '#functions';
import { logger } from '#logger';
import type LeaderboardCommand from '#root/commands/guild/leaderboard.js';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';
import { GuildMemberUtil, InteractionUtil, MessageUtil, type RepliableInteraction } from '#utils';

export default class extends DiscordJSEvent {
	public override readonly name = Events.InteractionCreate;

	private _visibilityButtonMessages = new Set<Snowflake>();

	/**
	 * @param interaction
	 */
	private async _handleChatInputCommandInteraction(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const command = this.client.commands.get(interaction.commandName);

		if (!command) {
			throw `the \`${interaction.commandName}\` command is currently disabled`;
		}

		// role permissions
		await command.assertPermissions(interaction);

		// command cooldowns
		if (command.timestamps) {
			const NOW = Date.now();
			const COOLDOWN_TIME = command.cooldown ?? this.config.get('COMMAND_COOLDOWN_DEFAULT');

			if (command.timestamps.has(interaction.user.id)) {
				const EXPIRATION_TIME = command.timestamps.get(interaction.user.id)! + COOLDOWN_TIME;

				if (NOW < EXPIRATION_TIME) {
					throw `\`${command.name}\` is on cooldown for another \`${ms(EXPIRATION_TIME - NOW, { long: true })}\``;
				}
			}

			command.timestamps.set(interaction.user.id, NOW);
			setTimeout(() => command.timestamps!.delete(interaction.user.id), COOLDOWN_TIME);
		}

		return command.chatInputRun(interaction);
	}

	/**
	 * @param interaction
	 */
	private async _handleButtonInteraction(interaction: ButtonInteraction<'cachedOrDM'>) {
		const [TYPE, ...args] = interaction.customId.split(':');

		switch (TYPE) {
			// InteractionUtil.awaitConfirmation, handled by a collector
			case CustomIdKey.Confirm:
				return;

			// leaderboard edits
			case CustomIdKey.Leaderboard:
				return handleLeaderboardButtonInteraction(interaction, args);

			// delete message
			case CustomIdKey.Delete:
				// check if button press is from the user that invoked the original interaction
				if (interaction.user.id !== args[0]) {
					return InteractionUtil.reply(interaction, {
						content: `you cannot delete messages from ${userMention(args[0]!)}`,
						ephemeral: true,
					});
				}

				return InteractionUtil.deleteMessage(interaction);

			// (un)pin message
			case CustomIdKey.Pin:
				if (
					interaction.channel?.type !== ChannelType.DM &&
					!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
				) {
					return InteractionUtil.reply(interaction, {
						content: 'you need the `ManageMessages` permission to (un)pin messages in this channel',
						ephemeral: true,
					});
				}

				void InteractionUtil.deferUpdate(interaction);
				return MessageUtil[interaction.message.pinned ? 'unpin' : 'pin'](interaction.message, {
					rejectOnError: true,
				});

			// change message visibility
			case CustomIdKey.Visibility:
				// deferUpdate to be able to edit the ephemeral message later after replying
				void InteractionUtil.deferUpdate(interaction);

				// no-op additional clicks on the same button
				if (this._visibilityButtonMessages.has(interaction.message.id)) return;

				try {
					this._visibilityButtonMessages.add(interaction.message.id);

					// remove visibility button from components
					const components: JSONEncodable<APIActionRowComponent<APIMessageActionRowComponent>>[] = [];

					for (const row of interaction.message.components) {
						// no visibility button
						if (row.components.at(-1)!.customId !== CustomIdKey.Visibility) {
							components.push(row);
							continue;
						}
						// button found

						// remove whole row if it only contains the visibility button
						if (row.components.length === 1) continue;

						// copy row and remove visibility button
						components.push(
							new ActionRowBuilder<MessageActionRowComponentBuilder>({
								components: row.components.slice(0, -1).map((row) => row.toJSON()),
							}),
						);
					}

					// send new non-ephemeral message
					await InteractionUtil.reply(interaction, {
						rejectOnError: true,
						content: interaction.message.content,
						embeds: interaction.message.embeds,
						files: interaction.message.attachments.map(({ url }) => url),
						components,
						ephemeral: false,
						allowedMentions: { parse: [] },
					});

					// delete the ephemeral message
					await InteractionUtil.deleteReply(interaction);
					return;
				} finally {
					this._visibilityButtonMessages.delete(interaction.message.id);
				}

			// command message buttons
			case CustomIdKey.Command: {
				const commandName = args.shift();
				const command = this.client.commands.get(commandName!);

				if (!command) {
					if (commandName) {
						throw `the \`${commandName}\` command is currently disabled`;
					}

					throw 'unknown button command';
				}

				// role permissions
				await command.assertPermissions(interaction);

				return command.buttonRun(interaction, args);
			}

			default:
		}
	}

	/**
	 * @param interaction
	 */
	private async _handleStringSelectMenuInteraction(interaction: StringSelectMenuInteraction<'cachedOrDM'>) {
		const [TYPE, ...args] = interaction.customId.split(':');

		switch (TYPE) {
			// leaderboard edits
			case CustomIdKey.Leaderboard:
				return handleLeaderboardSelectMenuInteraction(interaction, args);

			// command string select menus
			case CustomIdKey.Command: {
				const commandName = args.shift();
				const command = this.client.commands.get(commandName!);

				if (!command) {
					if (commandName) {
						throw `the \`${commandName}\` command is currently disabled`;
					}

					return;
				}

				// role permissions
				await command.assertPermissions(interaction);

				return command.stringSelectMenuRun(interaction, args);
			}

			default:
		}
	}

	/**
	 * @param interaction
	 */
	private async _handleUserSelectMenuInteraction(interaction: UserSelectMenuInteraction<'cachedOrDM'>) {
		const [TYPE, ...args] = interaction.customId.split(':');

		switch (TYPE) {
			// command user select menus
			case CustomIdKey.Command: {
				const commandName = args.shift();
				const command = this.client.commands.get(commandName!);

				if (!command) {
					if (commandName) {
						throw `the \`${commandName}\` command is currently disabled`;
					}

					return;
				}

				// role permissions
				await command.assertPermissions(interaction);

				return command.userSelectMenuRun(interaction, args);
			}

			default:
		}
	}

	/**
	 * @param interaction
	 */
	private async _handleRoleSelectMenuInteraction(interaction: RoleSelectMenuInteraction<'cachedOrDM'>) {
		const [TYPE, ...args] = interaction.customId.split(':');

		switch (TYPE) {
			// command role select menus
			case CustomIdKey.Command: {
				const commandName = args.shift();
				const command = this.client.commands.get(commandName!);

				if (!command) {
					if (commandName) {
						throw `the \`${commandName}\` command is currently disabled`;
					}

					return;
				}

				// role permissions
				await command.assertPermissions(interaction);

				return command.roleSelectMenuRun(interaction, args);
			}

			default:
		}
	}

	/**
	 * @param interaction
	 */
	private async _handleMentionableSelectMenuInteraction(interaction: MentionableSelectMenuInteraction<'cachedOrDM'>) {
		const [TYPE, ...args] = interaction.customId.split(':');

		switch (TYPE) {
			// command mentionable select menus
			case CustomIdKey.Command: {
				const commandName = args.shift();
				const command = this.client.commands.get(commandName!);

				if (!command) {
					if (commandName) {
						throw `the \`${commandName}\` command is currently disabled`;
					}

					return;
				}

				// role permissions
				await command.assertPermissions(interaction);

				return command.mentionableSelectMenuRun(interaction, args);
			}

			default:
		}
	}

	/**
	 * @param interaction
	 */
	private async _handleChannelSelectMenuInteraction(interaction: ChannelSelectMenuInteraction<'cachedOrDM'>) {
		const [TYPE, ...args] = interaction.customId.split(':');

		switch (TYPE) {
			// command channel select menus
			case CustomIdKey.Command: {
				const commandName = args.shift();
				const command = this.client.commands.get(commandName!);

				if (!command) {
					if (commandName) {
						throw `the \`${commandName}\` command is currently disabled`;
					}

					return;
				}

				// role permissions
				await command.assertPermissions(interaction);

				return command.channelSelectMenuRun(interaction, args);
			}

			default:
		}
	}

	/**
	 * respond to autocomplete interactions
	 *
	 * @param interaction
	 */
	private async _handleAutocompleteInteraction(interaction: AutocompleteInteraction<'cachedOrDM'>) {
		const { name, value } = interaction.options.getFocused(true);

		switch (name) {
			case 'player':
			case 'target': {
				// no value yet -> don't sort
				if (!value) {
					return interaction.respond(
						InteractionUtil.getHypixelGuild(interaction)
							.players.map(({ minecraftUuid, ign }) => ({ name: ign, value: minecraftUuid }))
							.slice(0, ApplicationCommandOptionLimits.MaximumChoicesLength),
					);
				}

				// <@id> input
				if (value.startsWith('<')) return interaction.respond([{ name: value, value }]);

				// @displayName input
				if (value.startsWith('@')) {
					const { discordGuild: guild } = InteractionUtil.getHypixelGuild(interaction);
					if (!guild) return interaction.respond([]);

					const response: ApplicationCommandOptionChoiceData[] = [];

					for (const member of guild.members.cache.values()) {
						const player = GuildMemberUtil.getPlayer(member);
						if (!player) continue;

						response.push({ name: member.displayName, value: player.minecraftUuid });
					}

					// no displayName yet -> don't sort
					if (value === '@') {
						return interaction.respond(response.slice(0, ApplicationCommandOptionLimits.MaximumChoicesLength));
					}

					return interaction.respond(sortCache(response, value.slice(1), 'name', 'value'));
				}

				// target the whole guild, e.g. for mute
				if (name === 'target' && ['guild', 'everyone'].includes(value.toLowerCase())) {
					return interaction.respond([{ name: 'everyone', value: 'everyone' }]);
				}

				// return input if 'force' option is set
				if (InteractionUtil.checkForce(interaction)) {
					return interaction.respond([
						{ name: value, value },
						...sortCache(
							InteractionUtil.getHypixelGuild(interaction).players,
							value,
							'ign',
							'minecraftUuid',
							ApplicationCommandOptionLimits.MaximumChoicesLength - 1,
						),
					]);
				}

				// ign input
				return interaction.respond(
					sortCache(InteractionUtil.getHypixelGuild(interaction).players, value, 'ign', 'minecraftUuid'),
				);
			}

			case 'guild': {
				// no value yet -> don't sort
				if (!value) {
					const response: ApplicationCommandOptionChoiceData[] = [];

					if ((this.client.commands.get(interaction.commandName) as LeaderboardCommand)?.includeAllHypixelGuilds) {
						response.push({ name: 'All Guilds', value: GUILD_ID_ALL });
					}

					response.push(
						...this.client.hypixelGuilds.cache.map(({ guildId, name: guildName }) => ({
							name: guildName,
							value: guildId,
						})),
					);

					return interaction.respond(response.slice(0, ApplicationCommandOptionLimits.MaximumChoicesLength));
				}

				// all guilds
				const guilds = (this.client.commands.get(interaction.commandName) as LeaderboardCommand)
					?.includeAllHypixelGuilds
					? [{ name: 'All Guilds', guildId: GUILD_ID_ALL }, ...this.client.hypixelGuilds.cache.values()]
					: this.client.hypixelGuilds.cache;

				// specific guilds
				return interaction.respond(sortCache(guilds, value, 'name', 'guildId'));
			}

			default: {
				const command = this.client.commands.get(interaction.commandName);

				if (!command) return interaction.respond([]);

				// role permissions
				await command.assertPermissions(interaction);

				return command.autocompleteRun(interaction, value, name);
			}
		}
	}

	/**
	 * @param interaction
	 */
	private async _handleMessageContextMenuInteraction(interaction: MessageContextMenuCommandInteraction<'cachedOrDM'>) {
		const command = this.client.commands.get(interaction.commandName);

		if (!command) {
			throw `the \`${interaction.commandName}\` command is currently disabled`;
		}

		// role permissions
		await command.assertPermissions(interaction);

		return command.messageContextMenuRun(interaction, interaction.targetMessage);
	}

	/**
	 * @param interaction
	 */
	private async _handleUserContextMenuInteraction(interaction: UserContextMenuCommandInteraction<'cachedOrDM'>) {
		const command = this.client.commands.get(interaction.commandName);

		if (!command) {
			throw `the \`${interaction.commandName}\` command is currently disabled`;
		}

		// role permissions
		await command.assertPermissions(interaction);

		const { user, member } = interaction.options.get('user')!;

		return command.userContextMenuRun(interaction, user!, member ?? null);
	}

	/**
	 * @param interaction
	 */
	private async _handleModalSubmitInteraction(interaction: ModalSubmitInteraction<'cachedOrDM'>) {
		const [TYPE, ...args] = interaction.customId.split(':');

		switch (TYPE) {
			// command message buttons
			case CustomIdKey.Command: {
				const commandName = args.shift();
				const command = this.client.commands.get(commandName!);

				if (!command) {
					if (commandName) {
						throw `the \`${commandName}\` command is currently disabled`;
					}

					throw 'unknown modal';
				}

				// role permissions
				await command.assertPermissions(interaction);

				return command.modalSubmitRun(interaction, args);
			}

			default:
		}
	}

	/**
	 * @param interaction
	 */
	private _handleRepliableInteraction(interaction: RepliableInteraction<'cachedOrDM'>) {
		InteractionUtil.add(interaction);
		this.client.chatBridges.handleInteractionCreate(interaction);
		logger.info(InteractionUtil.logInfo(interaction), '[INTERACTION CREATE]');
	}

	/**
	 * event listener callback
	 *
	 * @param interaction
	 */
	public override async run(interaction: ClientEvents[Events.InteractionCreate][0]) {
		if (!InteractionUtil.inCachedGuildOrDM(interaction)) return;

		try {
			switch (interaction.type) {
				case InteractionType.ApplicationCommand:
					this._handleRepliableInteraction(interaction);

					switch (interaction.commandType) {
						case ApplicationCommandType.ChatInput:
							await this._handleChatInputCommandInteraction(interaction);
							return;

						case ApplicationCommandType.Message:
							await this._handleMessageContextMenuInteraction(interaction);
							return;

						case ApplicationCommandType.User:
							await this._handleUserContextMenuInteraction(interaction);
							return;

						default:
							return assertNever(interaction);
					}

				case InteractionType.ApplicationCommandAutocomplete:
					await this._handleAutocompleteInteraction(interaction);
					return;

				case InteractionType.MessageComponent:
					this._handleRepliableInteraction(interaction);

					switch (interaction.componentType) {
						case ComponentType.Button:
							await this._handleButtonInteraction(interaction);
							return;

						case ComponentType.StringSelect:
							await this._handleStringSelectMenuInteraction(interaction);
							return;

						case ComponentType.UserSelect:
							await this._handleUserSelectMenuInteraction(interaction);
							return;

						case ComponentType.RoleSelect:
							await this._handleRoleSelectMenuInteraction(interaction);
							return;

						case ComponentType.MentionableSelect:
							await this._handleMentionableSelectMenuInteraction(interaction);
							return;

						case ComponentType.ChannelSelect:
							await this._handleChannelSelectMenuInteraction(interaction);
							return;

						default:
							return assertNever(interaction);
					}

				case InteractionType.ModalSubmit:
					this._handleRepliableInteraction(interaction);

					await this._handleModalSubmitInteraction(interaction);
					return;

				default:
					return assertNever(interaction);
			}
		} catch (error) {
			logger.error({ err: error, ...InteractionUtil.logInfo(interaction) }, '[INTERACTION CREATE]');

			if (InteractionUtil.isInteractionError(error)) return; // interaction expired

			// respond to interaction
			if (interaction.type !== InteractionType.ApplicationCommandAutocomplete) {
				// reply with error
				return void InteractionUtil.reply(interaction, {
					content: typeof error === 'string' ? error : `an error occurred while executing the command: ${error}`,
					ephemeral: true,
					allowedMentions: { parse: [], repliedUser: true },
				});
			}

			// autocomplete -> send empty choices
			if (interaction.responded) return;
			try {
				await interaction.respond([]);
			} catch (_error) {
				logger.error({ err: _error, ...InteractionUtil.logInfo(interaction) }, '[INTERACTION CREATE]');
			}
		}
	}
}
