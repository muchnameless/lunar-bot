import {
	ApplicationCommandPermissionType,
	ApplicationCommandType,
	PermissionFlagsBits,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandGroupBuilder,
} from 'discord.js';
import { logger } from '#logger';
import { InteractionUtil } from '#utils';
import { CustomIdKey } from '#constants';
import { missingPermissionsError } from '../errors/MissingPermissionsError';
import { ephemeralOption } from './commonOptions';
import { BaseCommand } from './BaseCommand';
import type { Awaitable } from '@sapphire/utilities';
import type {
	APIApplicationCommandPermission,
	AutocompleteInteraction,
	ButtonInteraction,
	ChatInputCommandInteraction,
	ContextMenuCommandBuilder,
	GuildMember,
	Interaction,
	Message,
	MessageContextMenuCommandInteraction,
	ModalSubmitInteraction,
	RESTPostAPIApplicationCommandsJSONBody,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
	RESTPostAPIContextMenuApplicationCommandsJSONBody,
	SelectMenuInteraction,
	SlashCommandBooleanOption,
	SlashCommandBuilder,
	SlashCommandChannelOption,
	SlashCommandIntegerOption,
	SlashCommandMentionableOption,
	SlashCommandNumberOption,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandRoleOption,
	SlashCommandStringOption,
	SlashCommandSubcommandsOnlyBuilder,
	SlashCommandUserOption,
	Snowflake,
	User,
	UserContextMenuCommandInteraction,
} from 'discord.js';
import type { HypixelGuild } from '../database/models/HypixelGuild';
import type { CommandContext, CommandData } from './BaseCommand';

type Slash =
	| SlashCommandBuilder
	| SlashCommandSubcommandsOnlyBuilder
	| SlashCommandOptionsOnlyBuilder
	| Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

interface AssertPermissionsOptions {
	roleIds?: Snowflake[] | null;
	hypixelGuild?: HypixelGuild;
}

export type SlashCommandOption =
	| SlashCommandRoleOption
	| SlashCommandUserOption
	| SlashCommandStringOption
	| SlashCommandNumberOption
	| SlashCommandBooleanOption
	| SlashCommandChannelOption
	| SlashCommandChannelOption
	| SlashCommandIntegerOption
	| SlashCommandMentionableOption;

export interface ApplicationCommandData extends CommandData {
	aliases?: string[];
	slash?: Slash;
	message?: ContextMenuCommandBuilder;
	user?: ContextMenuCommandBuilder;
}

export class ApplicationCommand extends BaseCommand {
	slash: RESTPostAPIChatInputApplicationCommandsJSONBody | null = null;
	message: RESTPostAPIContextMenuApplicationCommandsJSONBody | null = null;
	user: RESTPostAPIContextMenuApplicationCommandsJSONBody | null = null;
	slashAliases: string[] | null = null;

	/**
	 * create a new command
	 * @param context
	 * @param data
	 */
	constructor(context: CommandContext, { aliases, slash, message, user, ...data }: ApplicationCommandData) {
		super(context, data);

		/**
		 * slash commands
		 */

		if (slash) {
			ApplicationCommand._setDefaultPermissions(this, slash as SlashCommandBuilder);

			if (aliases) {
				this.aliases ??= [];
				this.aliases.push(...aliases);

				const nonEmptyAliases = aliases.map((alias) => alias.toLowerCase()).filter(Boolean);
				this.slashAliases = nonEmptyAliases.length ? nonEmptyAliases : null;
			}

			if (!slash.name) {
				slash.setName(this.name);
			} else if (slash.name !== this.name) {
				this.aliases ??= [];
				this.aliases.push(slash.name);
			}

			// add ephemeral option to every (sub)command(group)
			if ((slash as SlashCommandBuilder).options.length) {
				for (const option of (slash as SlashCommandBuilder).options) {
					if (option instanceof SlashCommandSubcommandGroupBuilder) {
						for (const subcommand of option.options) {
							(subcommand as SlashCommandSubcommandBuilder).addStringOption(ephemeralOption);
						}
					} else if (option instanceof SlashCommandSubcommandBuilder) {
						option.addStringOption(ephemeralOption);
					} else {
						// no subcommand(group) -> only add one ephemeralOption
						(slash as SlashCommandBuilder).addStringOption(ephemeralOption);
						break;
					}
				}
			} else {
				(slash as SlashCommandBuilder).addStringOption(ephemeralOption);
			}

			// @ts-expect-error
			this.slash = slash.toJSON();
		}

		/**
		 * context menu interactions
		 */

		if (message) {
			ApplicationCommand._setDefaultPermissions(this, message);

			if (!message.name) {
				message.setName(this.name);
			} else if (message.name !== this.name) {
				this.aliases ??= [];
				this.aliases.push(message.name);
			}

			message.setType(ApplicationCommandType.Message);

			// @ts-expect-error
			this.message = message.toJSON();
		}

		if (user) {
			ApplicationCommand._setDefaultPermissions(this, user);

			if (!user.name) {
				user.setName(this.name);
			} else if (user.name !== this.name) {
				this.aliases ??= [];
				this.aliases.push(user.name);
			}

			user.setType(ApplicationCommandType.User);

			// @ts-expect-error
			this.user = user.toJSON();
		}
	}

	/**
	 * component customId to identify this command in the handler. everything after it gets provided as args split by ':'
	 */
	get baseCustomId() {
		return `${CustomIdKey.Command}:${this.name}` as const;
	}

	/**
	 * array of RESTPostAPIApplicationCommandsJSONBody containing all application commands
	 */
	get data() {
		const data: RESTPostAPIApplicationCommandsJSONBody[] = [];

		if (this.slash) {
			data.push(this.slash);

			if (this.slashAliases) {
				for (const alias of this.slashAliases) {
					data.push({ ...this.slash, name: alias });
				}
			}
		}

		if (this.message) data.push(this.message);
		if (this.user) data.push(this.user);

		return data;
	}

	/**
	 * must not exceed 4k
	 */
	get dataLength() {
		if (!this.slash) return null;

		/**
		 * recursively reduces options
		 * @param options
		 */
		const reduceOptions = (options?: typeof this.slash.options): number =>
			options?.reduce(
				(a1, c1) =>
					a1 +
					c1.name.length +
					c1.description.length +
					((c1 as SlashCommandStringOption).choices?.reduce(
						(a2, c2) => a2 + c2.name.length + `${c2.value}`.length,
						0,
					) ?? 0) +
					reduceOptions(
						// @ts-expect-error
						c1.options,
					),
				0,
			) ?? 0;

		return this.slash.name.length + this.slash.description.length + reduceOptions(this.slash.options);
	}

	/**
	 * adds permission defaults to a builder based on the command's category
	 * @param command
	 * @param builder
	 */
	private static _setDefaultPermissions(
		command: ApplicationCommand,
		builder:
			| Pick<SlashCommandBuilder, 'setDMPermission' | 'setDefaultMemberPermissions'>
			| Pick<ContextMenuCommandBuilder, 'setDMPermission' | 'setDefaultMemberPermissions'>,
	) {
		if (command._requiredRoles) {
			return void builder.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
		}

		switch (command.category) {
			case 'staff':
			case 'moderation':
			case 'tax':
			case 'manager':
				builder.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
				break;

			case 'owner':
				// disable command
				builder.setDefaultMemberPermissions('0');
				break;
		}
	}

	/**
	 * returns discord application command permission data
	 */
	permissionsFor(guildId: Snowflake) {
		const discordGuild = this.client.discordGuilds.cache.get(guildId);
		if (!discordGuild) throw new Error(`[PERMISSIONS FOR]: ${this.name}: no discord guild`);

		const permissions: APIApplicationCommandPermission[] = [];

		for (const hypixelGuildId of discordGuild.hypixelGuildIds) {
			const hypixelGuild = this.client.hypixelGuilds.cache.get(hypixelGuildId);
			if (!hypixelGuild) throw new Error(`[PERMISSIONS FOR]: ${this.name}: no hypixel guild`);

			const requiredRoles = this.requiredRoles(hypixelGuild);

			// no roles to add
			if (requiredRoles == null) continue;

			for (const roleId of requiredRoles) {
				// role already added (by another hypixel guild)
				if (permissions.some(({ id }) => id === roleId)) continue;

				permissions.push({
					id: roleId,
					type: ApplicationCommandPermissionType.Role,
					permission: true,
				});
			}
		}

		// disallow for everyone but the owner by default
		if (permissions.length || this.category === 'owner') {
			permissions.push(
				{
					id: this.client.ownerId, // allow all commands for the bot owner
					type: ApplicationCommandPermissionType.User,
					permission: true,
				},
				{
					id: discordGuild.discordId, // deny for the guild @everyone role
					type: ApplicationCommandPermissionType.Role,
					permission: false,
				},
			);
		}

		return permissions;
	}

	/**
	 * rejects on missing permissions
	 * @param interaction
	 * @param options
	 */
	async assertPermissions(
		interaction: Interaction<'cachedOrDM'>,
		{
			hypixelGuild = InteractionUtil.getHypixelGuild(interaction),
			roleIds = this.requiredRoles(hypixelGuild),
		}: AssertPermissionsOptions = {},
	) {
		// owner bypass
		if (interaction.user.id === this.client.ownerId) return;

		// user is not the owner at this point
		if (this.category === 'owner') {
			throw `${interaction.user} is not in the sudoers file. This incident will be reported.`;
		}

		if (!roleIds) return; // no role requirements

		const member =
			interaction.guildId !== null && interaction.guildId === hypixelGuild.discordId
				? interaction.member!
				: await (async () => {
						const { discordGuild } = hypixelGuild;

						if (!discordGuild) {
							throw missingPermissionsError('discord server unreachable', interaction, discordGuild, roleIds);
						}

						try {
							return await discordGuild.members.fetch(interaction.user);
						} catch (error) {
							logger.error(error, '[CHECK PERMISSIONS]: error while fetching member to test for permissions');
							throw missingPermissionsError('unknown discord member', interaction, discordGuild, roleIds);
						}
				  })();

		// check for req roles
		if (!member.roles.cache.hasAny(...roleIds)) {
			throw missingPermissionsError('missing required role', interaction, hypixelGuild.discordGuild, roleIds);
		}
	}

	/* eslint-disable @typescript-eslint/no-unused-vars */

	/**
	 * @param interaction
	 * @param value input value
	 * @param name option name
	 */
	autocompleteRun(
		interaction: AutocompleteInteraction<'cachedOrDM'>,
		value: string | number,
		name: string,
	): Awaitable<unknown> {
		throw new Error('no run function specified for autocomplete');
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param user
	 * @param member
	 */
	userContextMenuRun(
		interaction: UserContextMenuCommandInteraction<'cachedOrDM'>,
		user: User,
		member: GuildMember | null,
	): Awaitable<unknown> {
		throw new Error('no run function specified for user context menus');
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param message
	 */
	messageContextMenuRun(
		interaction: MessageContextMenuCommandInteraction<'cachedOrDM'>,
		message: Message,
	): Awaitable<unknown> {
		throw new Error('no run function specified for message context menus');
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	selectMenuRun(interaction: SelectMenuInteraction<'cachedOrDM'>, args: string[]): Awaitable<unknown> {
		throw new Error('no run function specified for select menus');
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	buttonRun(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]): Awaitable<unknown> {
		throw new Error('no run function specified for buttons');
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	modalSubmitRun(interaction: ModalSubmitInteraction<'cachedOrDM'>, args: string[]): Awaitable<unknown> {
		throw new Error('no run function specified for buttons');
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>): Awaitable<unknown> {
		throw new Error('no run function specified for slash commands');
	}

	/* eslint-enable @typescript-eslint/no-unused-vars */
}
