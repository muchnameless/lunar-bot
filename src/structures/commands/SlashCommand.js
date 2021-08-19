import { SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { Constants } from 'discord.js';
import { missingPermissionsError } from '../errors/MissingPermissionsError.js';
import { ephemeralOption } from './commonOptions.js';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { BaseCommand } from './BaseCommand.js';
import { logger } from '../../functions/logger.js';


/**
 * @typedef {object} CommandData
 * @property {?string[]} aliases
 * @property {import('@discordjs/builders').SlashCommandBuilder} slash
 * @property {import('discord.js').ApplicationCommandPermissions} permissions
 * @property {?number} cooldown
 * @property {() => import('discord.js').Snowflake[]} requiredRoles
 */


export class SlashCommand extends BaseCommand {
	/**
	 * create a new command
	 * @param {import('./BaseCommand').CommandContext} context
	 * @param {CommandData} param1
	 */
	constructor(context, { aliases, slash, cooldown, requiredRoles }) {
		super(context, { cooldown, requiredRoles });

		/** @type {?string[]} */
		this.aliases = aliases?.length ? aliases.filter(Boolean) : null;
		this.slash = slash;

		/**
		 * complete slash command data
		 */

		// add name (from context (file name))
		this.slash.setName(this.name);

		// add ephemeral option to every (sub)command(group)
		for (const option of this.slash.options) {
			if (option instanceof SlashCommandSubcommandGroupBuilder) {
				for (const subcommand of this.slash.options) {
					subcommand.addStringOption(ephemeralOption);
				}
			} else if (option instanceof SlashCommandSubcommandBuilder) {
				option.addStringOption(ephemeralOption);
			} else { // no subcommand(group) -> only add one ephemeralOption
				this.slash.addStringOption(ephemeralOption);
				break;
			}
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
		 * @param {import('discord.js').ApplicationCommandOption[]} options
		 * @returns {number}
		 */
		const reduceOptions = options => options?.reduce((a1, c1) => a1 + c1.name.length + c1.description.length + (c1.choices?.reduce((a2, c2) => a2 + c2.name.length + `${c2.value}`.length, 0) ?? 0) + reduceOptions(c1.options), 0) ?? 0;

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
			/** @type {import('discord.js').Snowflake} */
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 * @param {{ userIds?: import('discord.js').Snowflake[], roleIds?: import('discord.js').Snowflake[] }} [permissions]
	 */
	async checkPermissions(interaction, { userIds = [ this.client.ownerId ], roleIds = this.requiredRoles } = {}) {
		if (userIds?.includes(interaction.user.id)) return; // user id bypass
		if (!roleIds?.length) return; // no role requirements

		/** @type {import('discord.js').GuildMember} */
		const member = interaction.guildId === this.config.get('DISCORD_GUILD_ID')
			? interaction.member
			: await (async () => {
				const { lgGuild } = this.client;

				if (!lgGuild) throw missingPermissionsError('discord server unreachable', interaction, roleIds);

				InteractionUtil.deferReply(interaction);

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
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) { // eslint-disable-line no-unused-vars
		throw new Error('no run function specified');
	}
}
