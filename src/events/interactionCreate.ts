import { setTimeout } from 'node:timers';
import ms from 'ms';
import { ApplicationCommandType, ComponentType, Formatters, InteractionType } from 'discord.js';
import { COMMAND_KEY, DELETE_KEY, GUILD_ID_ALL, LB_KEY, MAX_CHOICES } from '../constants';
import { GuildMemberUtil, InteractionUtil } from '../util';
import {
	handleLeaderboardButtonInteraction,
	handleLeaderboardSelectMenuInteraction,
	logger,
	minutes,
	sortCache,
} from '../functions';
import { Event, type EventContext } from '../structures/events/Event';
import type {
	ApplicationCommandOptionChoice,
	AutocompleteInteraction,
	BaseGuildTextChannel,
	ButtonInteraction,
	ChatInputCommandInteraction,
	ContextMenuCommandInteraction,
	GuildMember,
	Message,
	SelectMenuInteraction,
} from 'discord.js';
import type { ChatInteraction } from '../util/InteractionUtil';
import type LeaderboardCommand from '../commands/guild/leaderboard';

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
	private async _handleCommandInteraction(interaction: ChatInputCommandInteraction) {
		logger.info(
			{
				type: InteractionType[interaction.type],
				command: interaction.toString(),
				user: interaction.member
					? `${(interaction.member as GuildMember).displayName} | ${interaction.user.tag}`
					: interaction.user.tag,
				channel: interaction.guildId
					? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
					: 'DM',
				guild: interaction.guild?.name ?? null,
			},
			'INTERACTION_CREATE',
		);

		if (this.client.chatBridges.channelIds.has(interaction.channelId)) {
			this.client.chatBridges.interactionCache.set(interaction.id, interaction);
			setTimeout(() => this.client.chatBridges.interactionCache.delete(interaction.id), minutes(1));
		}

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

		return command.runSlash(interaction);
	}

	/**
	 * @param interaction
	 */
	private async _handleButtonInteraction(interaction: ButtonInteraction) {
		logger.info(
			{
				type: ComponentType[interaction.componentType],
				customId: interaction.customId,
				user: interaction.member
					? `${(interaction.member as GuildMember).displayName} | ${interaction.user.tag}`
					: interaction.user.tag,
				channel: interaction.guildId
					? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
					: 'DM',
				guild: interaction.guild?.name ?? null,
			},
			'INTERACTION_CREATE',
		);

		const args = interaction.customId.split(':');
		const TYPE = args.shift();

		switch (TYPE) {
			// leaderboards edit
			case LB_KEY:
				return handleLeaderboardButtonInteraction(interaction, args);

			// message delete
			case DELETE_KEY:
				// check if button press is from the user that invoked the original interaction
				if (interaction.user.id !== args[0]) {
					return InteractionUtil.reply(interaction, {
						content: `you cannot delete messages from ${Formatters.userMention(args[0])}`,
						ephemeral: true,
					});
				}

				return InteractionUtil.deleteMessage(interaction);

			// command message buttons
			case COMMAND_KEY: {
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

				return command.runButton(interaction, args);
			}
		}
	}

	/**
	 * @param interaction
	 */
	private async _handleSelectMenuInteraction(interaction: SelectMenuInteraction) {
		logger.info(
			{
				type: ComponentType[interaction.componentType],
				customId: interaction.customId,
				values: interaction.values,
				user: interaction.member
					? `${(interaction.member as GuildMember).displayName} | ${interaction.user.tag}`
					: interaction.user.tag,
				channel: interaction.guildId
					? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
					: 'DM',
				guild: interaction.guild?.name ?? null,
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
			case COMMAND_KEY: {
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

				return command.runSelect(interaction, args);
			}
		}
	}

	/**
	 * respond to autocomplete interactions
	 * @param interaction
	 */
	private async _handleAutocompleteInteraction(interaction: AutocompleteInteraction) {
		const { name, value } = interaction.options.getFocused(true) as { name: string; value: string };

		switch (name) {
			case 'player':
			case 'target': {
				// no value yet -> don't sort
				if (!value) {
					return interaction.respond(
						InteractionUtil.getHypixelGuild(interaction)
							.players.map(({ minecraftUuid, ign }) => ({ name: ign, value: minecraftUuid }))
							.slice(0, MAX_CHOICES),
					);
				}

				// <@id> input
				if (value.startsWith('<')) return interaction.respond([{ name: value, value }]);

				// @displayName input
				if (value.startsWith('@')) {
					const { discordGuild: guild } = InteractionUtil.getHypixelGuild(interaction);
					if (!guild) return interaction.respond([]);

					const response: ApplicationCommandOptionChoice[] = [];

					for (const member of guild.members.cache.values()) {
						const player = GuildMemberUtil.getPlayer(member);
						if (!player) continue;

						response.push({ name: member.displayName, value: player.minecraftUuid });
					}

					// no displayName yet -> don't sort
					if (value === '@') {
						return interaction.respond(response.slice(0, MAX_CHOICES));
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
							MAX_CHOICES - 1,
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
					const response: ApplicationCommandOptionChoice[] = [];

					if ((this.client.commands.get(interaction.commandName) as LeaderboardCommand)?.includeAllHypixelGuilds) {
						response.push({ name: 'All Guilds', value: GUILD_ID_ALL });
					}

					response.push(
						...this.client.hypixelGuilds.cache.map(({ guildId, name: guildName }) => ({
							name: guildName,
							value: guildId,
						})),
					);

					return interaction.respond(response.slice(0, MAX_CHOICES));
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

				return command.runAutocomplete(interaction, value, name);
			}
		}
	}

	/**
	 * @param interaction
	 */
	private async _handleContextMenuInteraction(interaction: ContextMenuCommandInteraction) {
		logger.info(
			{
				type: ApplicationCommandType[interaction.commandType],
				command: interaction.commandName,
				user: interaction.member
					? `${(interaction.member as GuildMember).displayName} | ${interaction.user.tag}`
					: interaction.user.tag,
				channel: interaction.guildId
					? (interaction.channel as BaseGuildTextChannel)?.name ?? interaction.channelId
					: 'DM',
				guild: interaction.guild?.name ?? null,
			},
			'INTERACTION_CREATE',
		);

		const command = this.client.commands.get(interaction.commandName);

		if (!command) {
			throw `the \`${interaction.commandName}\` command is currently disabled`;
		}

		// role permissions
		await command.assertPermissions(interaction);

		switch (interaction.commandType) {
			case ApplicationCommandType.Message:
				return command.runMessage(interaction, interaction.options.getMessage('message') as Message);

			case ApplicationCommandType.User: {
				const { user, member } = interaction.options.get('user')!;
				return command.runUser(interaction, user!, (member as GuildMember) ?? null);
			}

			default: {
				const e: never = interaction.targetType;
				logger.error(`[HANDLE CONTEXT MENU]: unknown target type: ${e}`);
			}
		}
	}

	/**
	 * event listener callback
	 * @param interaction
	 */
	override async run(interaction: ChatInteraction | AutocompleteInteraction) {
		try {
			// autocomplete
			if (interaction.isAutocomplete()) return await this._handleAutocompleteInteraction(interaction);

			// add interaction to the WeakMap which holds InteractionData
			InteractionUtil.add(interaction);

			// commands
			if (interaction.isChatInputCommand()) return await this._handleCommandInteraction(interaction);

			// buttons
			if (interaction.isButton()) return await this._handleButtonInteraction(interaction);

			// select menus
			if (interaction.isSelectMenu()) return await this._handleSelectMenuInteraction(interaction);

			// context menu
			if (interaction.isContextMenuCommand()) return await this._handleContextMenuInteraction(interaction);

			throw `unknown interaction type '${interaction.type}'`;
		} catch (error) {
			logger.error({ err: error, ...InteractionUtil.logInfo(interaction) }, '[INTERACTION CREATE]');

			if (InteractionUtil.isInteractionError(error)) return; // interaction expired

			// autocomplete
			if (interaction.isAutocomplete()) {
				// send empty choices
				if (!interaction.responded) {
					try {
						await interaction.respond([]);
					} catch (error_) {
						logger.error({ err: error_, ...InteractionUtil.logInfo(interaction) }, '[INTERACTION CREATE]');
					}
				}

				return;
			}

			// other interactions
			InteractionUtil.reply(interaction, {
				content: typeof error === 'string' ? error : `an error occurred while executing the command: ${error}`,
				ephemeral: true,
				allowedMentions: { parse: [], repliedUser: true },
			});
		}
	}
}
