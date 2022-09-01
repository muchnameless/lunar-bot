import { setTimeout } from 'node:timers';
import ms from 'ms';
import {
	ActionRowBuilder,
	ApplicationCommandType,
	ChannelType,
	ComponentType,
	InteractionType,
	PermissionFlagsBits,
	userMention,
} from 'discord.js';
import { ApplicationCommandOptionLimits } from '@sapphire/discord-utilities';
import { GuildMemberUtil, InteractionUtil, MessageUtil } from '#utils';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';
import { CustomIdKey, GUILD_ID_ALL } from '#constants';
import {
	assertNever,
	handleLeaderboardButtonInteraction,
	handleLeaderboardSelectMenuInteraction,
	sortCache,
} from '#functions';
import type { RepliableInteraction } from '#utils';
import type {
	APIActionRowComponent,
	APIMessageActionRowComponent,
	ApplicationCommandOptionChoiceData,
	AutocompleteInteraction,
	ButtonInteraction,
	ChatInputCommandInteraction,
	ClientEvents,
	Events,
	JSONEncodable,
	MessageActionRowComponentBuilder,
	MessageContextMenuCommandInteraction,
	ModalSubmitInteraction,
	SelectMenuInteraction,
	Snowflake,
	UserContextMenuCommandInteraction,
} from 'discord.js';
import type LeaderboardCommand from '#root/commands/guild/leaderboard';

export default class InteractionCreateEvent extends Event {
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
		const args = interaction.customId.split(':');
		const TYPE = args.shift();

		switch (TYPE) {
			// InteractionUtil.awaitConfirmation, handled by a collector
			case CustomIdKey.Confirm:
				return;

			// leaderboards edit
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
				// deferUpdate to be able to edit the epehemeral message later after replying
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
								components: row.components.slice(0, -1).map((c) => c.toJSON()),
							}),
						);
					}

					// send new non-ephemeral message
					await InteractionUtil.reply(interaction, {
						rejectOnError: true,
						content: interaction.message.content || null,
						embeds: interaction.message.embeds,
						files: interaction.message.attachments.map(({ url }) => url),
						components,
						ephemeral: false,
						allowedMentions: { parse: [] },
					});

					// remove the button from the ephemeral message
					return await InteractionUtil.editReply(interaction, { components });
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
		}
	}

	/**
	 * @param interaction
	 */
	private async _handleSelectMenuInteraction(interaction: SelectMenuInteraction<'cachedOrDM'>) {
		const args = interaction.customId.split(':');
		const type = args.shift();

		switch (type) {
			// leaderboards edit
			case CustomIdKey.Leaderboard:
				return handleLeaderboardSelectMenuInteraction(interaction, args);

			// command message buttons
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

				return command.selectMenuRun(interaction, args);
			}
		}
	}

	/**
	 * respond to autocomplete interactions
	 * @param interaction
	 */
	private async _handleAutocompleteInteraction(interaction: AutocompleteInteraction<'cachedOrDM'>) {
		const { name, value } = interaction.options.getFocused(true) as { name: string; value: string };

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
		const args = interaction.customId.split(':');
		const TYPE = args.shift();

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
	 * @param interaction
	 */
	override async run(interaction: ClientEvents[Events.InteractionCreate][0]) {
		if (!InteractionUtil.inCachedGuildOrDM(interaction)) return;

		try {
			switch (interaction.type) {
				case InteractionType.ApplicationCommand:
					this._handleRepliableInteraction(interaction);

					switch (interaction.commandType) {
						case ApplicationCommandType.ChatInput:
							return void (await this._handleChatInputCommandInteraction(interaction));

						case ApplicationCommandType.Message:
							return void (await this._handleMessageContextMenuInteraction(interaction));

						case ApplicationCommandType.User:
							return void (await this._handleUserContextMenuInteraction(interaction));

						default:
							return assertNever(interaction);
					}

				case InteractionType.ApplicationCommandAutocomplete:
					return void (await this._handleAutocompleteInteraction(interaction));

				case InteractionType.MessageComponent:
					this._handleRepliableInteraction(interaction);

					switch (interaction.componentType) {
						case ComponentType.Button:
							return void (await this._handleButtonInteraction(interaction));

						case ComponentType.SelectMenu:
							return void (await this._handleSelectMenuInteraction(interaction));

						default:
							return assertNever(interaction);
					}

				case InteractionType.ModalSubmit:
					this._handleRepliableInteraction(interaction);

					return void (await this._handleModalSubmitInteraction(interaction));

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
