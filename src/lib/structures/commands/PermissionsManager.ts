import {
	ApplicationCommandPermissionType,
	Collection,
	inlineCode,
	type ClientEvents,
	type Events,
	type GuildMember,
	type Snowflake,
} from 'discord.js';
import { noConcurrency } from '#decorators';
import { assertNever } from '#functions';
import { logger } from '#logger';
import type { LunarClient } from '#structures/LunarClient.js';

interface CommandPermissions {
	roles: {
		allowed: Snowflake[] | null;
		denied: Snowflake[] | null;
	};
	users: Map<Snowflake, boolean> | null;
}

// type aliases
type GuildId = Snowflake;
type CommandId = Snowflake;

export class PermissionsManager {
	public declare readonly client: LunarClient<true>;

	public readonly cache = new Collection<GuildId, Collection<CommandId, CommandPermissions>>();

	private _ready = false;

	public constructor(client: LunarClient) {
		Object.defineProperty(this, 'client', { value: client });
	}

	/**
	 * populates the cache with the current permissions
	 */
	@noConcurrency
	public async init() {
		try {
			for (const guild of this.client.guilds.cache.values()) {
				const permissions = await guild.commands.permissions.fetch();

				if (!permissions.size) continue;

				for (const [commandId, _permissions] of permissions) {
					this.update({ id: commandId, permissions: _permissions, guildId: guild.id });
				}
			}

			this._ready = true;
		} catch (error) {
			logger.error(error, '[PERMISSIONS]');
			throw new Error('Error fetching command permissions');
		}

		return this;
	}

	/**
	 * updates the cache
	 *
	 * @param data
	 */
	public update({
		id: commandId,
		guildId,
		permissions,
	}: Pick<ClientEvents[Events.ApplicationCommandPermissionsUpdate][0], 'guildId' | 'id' | 'permissions'>) {
		const guildPerms = this.cache.ensure(guildId, () => new Collection<CommandId, CommandPermissions>());
		const parsedPerms: CommandPermissions = {
			users: null,
			roles: {
				allowed: null,
				denied: null,
			},
		};

		for (const { id, type, permission } of permissions) {
			switch (type) {
				case ApplicationCommandPermissionType.Channel:
					// ignore channel permissions
					continue;

				case ApplicationCommandPermissionType.Role:
					(parsedPerms.roles[permission ? 'allowed' : 'denied'] ??= []).push(id);
					continue;

				case ApplicationCommandPermissionType.User:
					(parsedPerms.users ??= new Map()).set(id, permission);
					continue;

				default:
					assertNever(type);
			}
		}

		guildPerms.set(commandId, parsedPerms);
	}

	/**
	 * throws if the member doesn't have the required permissions
	 *
	 * @param guildId
	 * @param commandId
	 * @param member
	 */
	public async assert(guildId: Snowflake, commandId: Snowflake, member: GuildMember | null) {
		if (!this._ready) await this.init();

		const permissions = this.cache.get(guildId)?.get(commandId);

		// no permissions to check for the command
		if (!permissions) return;

		if (!member) {
			throw `no discord member to check permissions for the ${inlineCode(
				this.client.application.commands.cache.get(commandId)?.name ?? commandId,
			)} command in ${inlineCode(this.client.guilds.cache.get(guildId)?.name ?? guildId)}`;
		}

		// users
		switch (permissions.users?.get(member.id)) {
			case true:
				// explicit allow
				return;

			case false:
				// explicit deny
				throw `you are explicitly denied access to the ${inlineCode(
					this.client.application.commands.cache.get(commandId)?.name ?? commandId,
				)} command in ${inlineCode(this.client.guilds.cache.get(guildId)?.name ?? guildId)}`;

			case undefined:
		}

		// roles
		let roleCache: GuildMember['roles']['cache'] | undefined;

		if (permissions.roles.allowed) {
			roleCache = member.roles.cache;

			for (const roleId of permissions.roles.allowed) {
				// explicit allow
				if (roleCache.has(roleId)) return;
			}
		}

		if (permissions.roles.denied) {
			roleCache ??= member.roles.cache;

			for (const roleId of permissions.roles.denied) {
				if (roleCache.has(roleId)) {
					// explicit deny
					throw `the ${
						this.client.guilds.cache.get(guildId)?.roles.cache.get(roleId)?.name ?? roleId
					} role in ${inlineCode(
						this.client.guilds.cache.get(guildId)?.name ?? guildId,
					)} is denied access to the ${inlineCode(
						this.client.application.commands.cache.get(commandId)?.name ?? commandId,
					)} command`;
				}
			}
		}
	}
}
