import { SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { Constants } from 'discord.js';
import { missingPermissionsError } from '../errors/MissingPermissionsError';
import { ephemeralOption } from './commonOptions';
import { logger } from '../../functions';
import { BaseCommand } from './BaseCommand';
import type { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder, ToAPIApplicationCommandOptions } from '@discordjs/builders';
import type {
	ApplicationCommandPermissions,
	ButtonInteraction,
	CommandInteraction,
	ContextMenuInteraction,
	GuildMember,
	Interaction,
	SelectMenuInteraction,
	Snowflake,
} from 'discord.js';
import type { CommandContext, RequiredRoles } from './BaseCommand';


type Slash = SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder & { options: ToAPIApplicationCommandOptions[] } | SlashCommandOptionsOnlyBuilder;

export interface SlashCommandData {
	aliases?: string[],
	slash: Slash,
	permissions?: ApplicationCommandPermissions,
	cooldown?: number,
	requiredRoles?: RequiredRoles,

}


export class SlashCommand extends BaseCommand {
	slash: Slash;

	/**
	 * create a new command
	 * @param context
	 * @param data
	 */
	constructor(context: CommandContext, { aliases, slash, cooldown, requiredRoles }: SlashCommandData) {
		super(context, { cooldown, requiredRoles });

		this.aliases = aliases?.length ? aliases.filter(Boolean) : null;
		this.slash = slash;

		/**
		 * complete slash command data
		 */

		// add name (from context (file name))
		this.slash.setName(this.name);

		// add ephemeral option to every (sub)command(group)
		if (this.slash.options.length) {
			for (const option of this.slash.options) {
				if (option instanceof SlashCommandSubcommandGroupBuilder) {
					for (const subcommand of option.options) {
						// @ts-expect-error Property 'addStringOption' does not exist on type 'ToAPIApplicationCommandOptions'
						subcommand.addStringOption(ephemeralOption);
					}
				} else if (option instanceof SlashCommandSubcommandBuilder) {
					option.addStringOption(ephemeralOption);
				} else { // no subcommand(group) -> only add one ephemeralOption
					(this.slash as SlashCommandBuilder).addStringOption(ephemeralOption);
					break;
				}
			}
		} else {
			(this.slash as SlashCommandBuilder).addStringOption(ephemeralOption);
		}
	}

	/**
	 * data to send to the API
	 */
	get data() {
		return this.slash.toJSON();
	}

	/**
	 * must not exceed 4k
	 */
	get dataLength() {
		const { data } = this;
		/**
		 * recursively reduces options
		 * @param options
		 */
		const reduceOptions = (options?: typeof data.options): number => options?.reduce((a1, c1) => a1 + c1.name.length + c1.description.length + (c1.choices?.reduce((a2, c2) => a2 + c2.name.length + `${c2.value}`.length, 0) ?? 0) + reduceOptions(c1.options), 0) ?? 0;

		return data.name.length
			+ data.description.length
			+ reduceOptions(data.options);
	}

	/**
	 * returns discord application command permission data
	 */
	get permissions() {
		const requiredRoles = this.requiredRoles?.filter(r => r !== null);

		if (!requiredRoles?.length && this.category !== 'owner') return null;

		const permissions = [{
			id: this.client.ownerId, // allow all commands for the bot owner
			type: Constants.ApplicationCommandPermissionTypes.USER,
			permission: true,
		}, {
			id: this.config.get('DISCORD_GUILD_ID'), // deny for the guild @everyone role
			type: Constants.ApplicationCommandPermissionTypes.ROLE,
			permission: false,
		}];

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
	async checkPermissions(interaction: Interaction, { userIds = [ this.client.ownerId ], roleIds = this.requiredRoles }: { userIds?: Snowflake[] | null; roleIds?: Snowflake[] | null; } = {}) {
		if (userIds?.includes(interaction.user.id)) return; // user id bypass
		if (!roleIds?.length) return; // no role requirements

		const member = interaction.guildId === this.config.get('DISCORD_GUILD_ID')
			? interaction.member as GuildMember
			: await (async () => {
				const { lgGuild } = this.client;

				if (!lgGuild) throw missingPermissionsError('discord server unreachable', interaction, roleIds);

				try {
					return await lgGuild.members.fetch(interaction.user);
				} catch (error) {
					logger.error('[CHECK PERMISSIONS]: error while fetching member to test for permissions', error);
					throw missingPermissionsError('unknown discord member', interaction, roleIds);
				}
			})();

		// check for req roles
		if (!member.roles.cache.hasAny(...roleIds)) {
			throw missingPermissionsError('missing required role', interaction, roleIds);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	async runUser(interaction: ContextMenuInteraction): Promise<unknown> { // eslint-disable-line @typescript-eslint/no-unused-vars
		throw new Error('no run function specified for user context menus');
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	async runMessage(interaction: ContextMenuInteraction): Promise<unknown> { // eslint-disable-line @typescript-eslint/no-unused-vars
		throw new Error('no run function specified for message context menus');
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	async runSelect(interaction: SelectMenuInteraction): Promise<unknown> { // eslint-disable-line @typescript-eslint/no-unused-vars
		throw new Error('no run function specified for select menus');
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	async runButton(interaction: ButtonInteraction): Promise<unknown> { // eslint-disable-line @typescript-eslint/no-unused-vars
		throw new Error('no run function specified for buttons');
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	async runSlash(interaction: CommandInteraction): Promise<unknown> { // eslint-disable-line @typescript-eslint/no-unused-vars
		throw new Error('no run function specified for slash commands');
	}
}
