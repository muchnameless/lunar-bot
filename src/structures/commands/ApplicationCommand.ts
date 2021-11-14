import { SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { ApplicationCommandType } from 'discord-api-types/v9';
import { Constants } from 'discord.js';
import { missingPermissionsError } from '../errors/MissingPermissionsError';
import { ephemeralOption } from './commonOptions';
import { COMMAND_KEY } from '../../constants';
import { logger } from '../../functions';
import { BaseCommand } from './BaseCommand';
import type {
	ContextMenuCommandBuilder,
	SlashCommandBuilder,
	SlashCommandSubcommandsOnlyBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandIntegerOption,
	SlashCommandNumberOption,
	SlashCommandStringOption,
} from '@discordjs/builders';
import type {
	RESTPostAPIApplicationCommandsJSONBody,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
	RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord-api-types/v9';
import type {
	AutocompleteInteraction,
	ButtonInteraction,
	CommandInteraction,
	ContextMenuInteraction,
	GuildMember,
	Interaction,
	Message,
	SelectMenuInteraction,
	Snowflake,
	User,
} from 'discord.js';
import type { CommandContext, CommandData } from './BaseCommand';

type Slash =
	| SlashCommandBuilder
	| SlashCommandSubcommandsOnlyBuilder
	| SlashCommandOptionsOnlyBuilder
	| Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

type WithChoices = SlashCommandIntegerOption | SlashCommandNumberOption | SlashCommandStringOption;

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
			if (aliases) {
				this.aliases ??= [];
				this.aliases.push(...aliases);

				this.slashAliases = aliases.filter(Boolean).length
					? aliases.flatMap((alias) => (!alias ? [] : alias.toLowerCase()))
					: null;
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
		return `${COMMAND_KEY}:${this.name}` as const;
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
					((c1 as WithChoices).choices?.reduce((a2, c2) => a2 + c2.name.length + `${c2.value}`.length, 0) ?? 0) +
					reduceOptions(
						// @ts-expect-error
						c1.options,
					),
				0,
			) ?? 0;

		return this.slash.name.length + this.slash.description.length + reduceOptions(this.slash.options);
	}

	/**
	 * returns discord application command permission data
	 */
	get permissions() {
		const requiredRoles = this.requiredRoles?.filter((r) => r !== null);

		if (!requiredRoles?.length && this.category !== 'owner') return null;

		const permissions = [
			{
				id: this.client.ownerId, // allow all commands for the bot owner
				type: Constants.ApplicationCommandPermissionTypes.USER,
				permission: true,
			},
			{
				id: this.config.get('DISCORD_GUILD_ID'), // deny for the guild @everyone role
				type: Constants.ApplicationCommandPermissionTypes.ROLE,
				permission: false,
			},
		];

		if (requiredRoles) {
			for (const roleId of requiredRoles) {
				permissions.push({
					id: roleId,
					type: Constants.ApplicationCommandPermissionTypes.ROLE,
					permission: true,
				});
			}
		}

		return permissions;
	}

	/**
	 * @param interaction
	 * @param permissions
	 */
	async checkPermissions(
		interaction: Interaction,
		{
			userIds = [this.client.ownerId],
			roleIds = this.requiredRoles,
		}: { userIds?: Snowflake[] | null; roleIds?: Snowflake[] | null } = {},
	) {
		if (userIds?.includes(interaction.user.id)) return; // user id bypass
		if (!roleIds?.length) return; // no role requirements

		const member =
			interaction.guildId === this.config.get('DISCORD_GUILD_ID')
				? (interaction.member as GuildMember)
				: await (async () => {
						const { lgGuild } = this.client;

						if (!lgGuild) throw missingPermissionsError('discord server unreachable', interaction, roleIds);

						try {
							return await lgGuild.members.fetch(interaction.user);
						} catch (error) {
							logger.error(error, '[CHECK PERMISSIONS]: error while fetching member to test for permissions');
							throw missingPermissionsError('unknown discord member', interaction, roleIds);
						}
				  })();

		// check for req roles
		if (!member.roles.cache.hasAny(...roleIds)) {
			throw missingPermissionsError('missing required role', interaction, roleIds);
		}
	}

	/* eslint-disable @typescript-eslint/no-unused-vars */

	/**
	 * @param interaction
	 * @param name
	 * @param value
	 */
	runAutocomplete(
		interaction: AutocompleteInteraction,
		name: string,
		value: string | number,
	): unknown | Promise<unknown> {
		throw new Error('no run function specified for autocomplete');
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param user
	 * @param member
	 */
	runUser(interaction: ContextMenuInteraction, user: User, member: GuildMember | null): unknown | Promise<unknown> {
		throw new Error('no run function specified for user context menus');
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param message
	 */
	runMessage(interaction: ContextMenuInteraction, message: Message): unknown | Promise<unknown> {
		throw new Error('no run function specified for message context menus');
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	runSelect(interaction: SelectMenuInteraction, args: string[]): unknown | Promise<unknown> {
		throw new Error('no run function specified for select menus');
	}

	/**
	 * execute the command
	 * @param interaction
	 * @param args parsed customId, split by ':'
	 */
	runButton(interaction: ButtonInteraction, args: string[]): unknown | Promise<unknown> {
		throw new Error('no run function specified for buttons');
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	runSlash(interaction: CommandInteraction): unknown | Promise<unknown> {
		throw new Error('no run function specified for slash commands');
	}

	/* eslint-enable @typescript-eslint/no-unused-vars */
}
