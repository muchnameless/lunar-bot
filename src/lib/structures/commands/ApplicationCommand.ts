import {
	ApplicationCommandType,
	PermissionFlagsBits,
	SlashCommandSubcommandBuilder,
	SlashCommandSubcommandGroupBuilder,
	type AutocompleteInteraction,
	type Awaitable,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type CommandInteraction,
	type ContextMenuCommandBuilder,
	type GuildMember,
	type Interaction,
	type Message,
	type MessageContextMenuCommandInteraction,
	type ModalSubmitInteraction,
	type RESTPostAPIApplicationCommandsJSONBody,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
	type RESTPostAPIContextMenuApplicationCommandsJSONBody,
	type SelectMenuInteraction,
	type SlashCommandBooleanOption,
	type SlashCommandBuilder,
	type SlashCommandChannelOption,
	type SlashCommandIntegerOption,
	type SlashCommandMentionableOption,
	type SlashCommandNumberOption,
	type SlashCommandOptionsOnlyBuilder,
	type SlashCommandRoleOption,
	type SlashCommandStringOption,
	type SlashCommandSubcommandsOnlyBuilder,
	type SlashCommandUserOption,
	type Snowflake,
	type User,
	type UserContextMenuCommandInteraction,
} from 'discord.js';
import { BaseCommand, type CommandContext, type CommandData } from './BaseCommand.js';
import { ephemeralOption } from './commonOptions.js';
import { CustomIdKey } from '#constants';
import { logger } from '#logger';
import { type HypixelGuild } from '#structures/database/models/HypixelGuild.js';
import { missingPermissionsError } from '#structures/errors/MissingPermissionsError.js';
import { InteractionUtil } from '#utils';

type Slash =
	| Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
	| SlashCommandBuilder
	| SlashCommandOptionsOnlyBuilder
	| SlashCommandSubcommandsOnlyBuilder;

interface AssertPermissionsOptions {
	hypixelGuild?: HypixelGuild;
	roleIds?: Snowflake[] | null;
}

export type SlashCommandOption =
	| SlashCommandBooleanOption
	| SlashCommandChannelOption
	| SlashCommandChannelOption
	| SlashCommandIntegerOption
	| SlashCommandMentionableOption
	| SlashCommandNumberOption
	| SlashCommandRoleOption
	| SlashCommandStringOption
	| SlashCommandUserOption;

export interface ApplicationCommandData extends CommandData {
	aliases?: string[];
	message?: ContextMenuCommandBuilder;
	slash?: Slash;
	user?: ContextMenuCommandBuilder;
}

export class ApplicationCommand extends BaseCommand {
	public slash: RESTPostAPIChatInputApplicationCommandsJSONBody | null = null;

	public message: RESTPostAPIContextMenuApplicationCommandsJSONBody | null = null;

	public user: RESTPostAPIContextMenuApplicationCommandsJSONBody | null = null;

	public slashAliases: string[] | null = null;

	/**
	 * create a new command
	 *
	 * @param context
	 * @param data
	 */
	public constructor(context: CommandContext, { aliases, slash, message, user, ...data }: ApplicationCommandData) {
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

			this.slash = slash.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody;
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

			this.message = message.toJSON() as RESTPostAPIContextMenuApplicationCommandsJSONBody;
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

			this.user = user.toJSON() as RESTPostAPIContextMenuApplicationCommandsJSONBody;
		}
	}

	/**
	 * discord application command id (throws if not found in cache)
	 */
	public get commandId() {
		const commandId = this.client.application?.commands.cache.findKey(({ name }) => name === this.name);
		if (!commandId) throw new Error(`Command '${this.name}' not found in application commands cache`);
		return commandId;
	}

	/**
	 * component customId to identify this command in the handler. everything after it gets provided as args split by ':'
	 */
	public get baseCustomId() {
		return `${CustomIdKey.Command}:${this.name}` as const;
	}

	/**
	 * array of RESTPostAPIApplicationCommandsJSONBody containing all application commands
	 */
	public get data() {
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
	public get dataLength() {
		if (!this.slash) return null;

		/**
		 * recursively reduces options
		 *
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
						// @ts-expect-error options does not exist on type ...
						c1.options,
					),
				0,
			) ?? 0;

		return this.slash.name.length + this.slash.description.length + reduceOptions(this.slash.options);
	}

	/**
	 * adds permission defaults to a builder based on the command's category
	 *
	 * @param command
	 * @param builder
	 */
	private static _setDefaultPermissions(
		command: ApplicationCommand,
		builder:
			| Pick<ContextMenuCommandBuilder, 'setDefaultMemberPermissions' | 'setDMPermission'>
			| Pick<SlashCommandBuilder, 'setDefaultMemberPermissions' | 'setDMPermission'>,
	) {
		switch (command.category) {
			case 'staff':
			case 'moderation':
			case 'tax':
			case 'manager':
				return builder.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

			case 'owner':
				// disable command
				return builder.setDefaultMemberPermissions(0n);

			default:
				return builder;
		}
	}

	/**
	 * rejects on missing permissions
	 *
	 * @param interaction
	 * @param options
	 */
	public async assertPermissions(
		interaction: Interaction<'cachedOrDM'>,
		{
			hypixelGuild = InteractionUtil.getHypixelGuild(interaction),
			roleIds = this.requiredRoles(hypixelGuild),
		}: AssertPermissionsOptions = {},
	) {
		// owner bypass
		if (interaction.user.id === this.client.ownerId) return;

		// user is not the owner at this point
		if (
			this.category === 'owner' ||
			(interaction as AutocompleteInteraction | CommandInteraction).command?.defaultMemberPermissions?.bitfield === 0n
		) {
			throw `${interaction.user} is not in the sudoers file. This incident will be reported.`;
		}

		/**
		 * whether the interaction is from the hypixel guild's linked discord guild
		 */
		const IS_IN_LINKED_GUILD = interaction.guildId !== null && interaction.guildId === hypixelGuild.discordId;

		let member: GuildMember;

		if (IS_IN_LINKED_GUILD) {
			member = interaction.member!;
		} else {
			const { discordGuild } = hypixelGuild;

			if (!discordGuild) {
				throw missingPermissionsError('discord server unreachable', interaction, discordGuild, roleIds);
			}

			try {
				member = await discordGuild.members.fetch(interaction.user);
			} catch (error) {
				logger.error(error, '[ASSERT PERMISSIONS]: error while fetching member');
				throw missingPermissionsError('unknown discord member', interaction, discordGuild, roleIds);
			}
		}

		// hardcoded role ids
		if (roleIds && !member.roles.cache.hasAny(...roleIds)) {
			throw missingPermissionsError('missing required role', interaction, hypixelGuild.discordGuild, roleIds);
		}

		// discord already checked the permissions
		if (IS_IN_LINKED_GUILD) return;

		await this.client.permissions.assert(
			hypixelGuild.discordId!,
			(interaction as AutocompleteInteraction | CommandInteraction).commandId ?? this.commandId,
			member,
		);
	}

	/**
	 * @param interaction
	 * @param value - input value
	 * @param name - option name
	 */
	public autocompleteRun(
		interaction: AutocompleteInteraction<'cachedOrDM'>,
		value: number | string,
		name: string,
	): Awaitable<unknown> {
		throw new Error('no run function specified for autocomplete');
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param user
	 * @param member
	 */
	public userContextMenuRun(
		interaction: UserContextMenuCommandInteraction<'cachedOrDM'>,
		user: User,
		member: GuildMember | null,
	): Awaitable<unknown> {
		throw new Error('no run function specified for user context menus');
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param message
	 */
	public messageContextMenuRun(
		interaction: MessageContextMenuCommandInteraction<'cachedOrDM'>,
		message: Message,
	): Awaitable<unknown> {
		throw new Error('no run function specified for message context menus');
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param args - parsed customId, split by ':'
	 */
	public selectMenuRun(interaction: SelectMenuInteraction<'cachedOrDM'>, args: string[]): Awaitable<unknown> {
		throw new Error('no run function specified for select menus');
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param args - parsed customId, split by ':'
	 */
	public buttonRun(interaction: ButtonInteraction<'cachedOrDM'>, args: string[]): Awaitable<unknown> {
		throw new Error('no run function specified for buttons');
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param args - parsed customId, split by ':'
	 */
	public modalSubmitRun(interaction: ModalSubmitInteraction<'cachedOrDM'>, args: string[]): Awaitable<unknown> {
		throw new Error('no run function specified for buttons');
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>): Awaitable<unknown> {
		throw new Error('no run function specified for slash commands');
	}
}
