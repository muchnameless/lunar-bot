import { ApplicationCommandPermissionType, Collection } from 'discord.js';
import { logger } from '#logger';
import { assertNever } from '#functions';
import type { ClientEvents, Events, GuildMember, Snowflake, Role } from 'discord.js';
import type { LunarClient } from '../LunarClient';

interface CommandPermissions {
	users: Map<Snowflake, boolean> | null;
	roles: {
		allowed: Snowflake[] | null;
		denied: Snowflake[] | null;
	};
}

// type aliases
type GuildId = Snowflake;
type CommandId = Snowflake;

export class PermissionsManager {
	client: LunarClient;
	cache = new Collection<GuildId, Collection<CommandId, CommandPermissions>>();
	ready = false;
	private _initPromise: null | Promise<void> = null;

	constructor(client: LunarClient) {
		this.client = client;
	}

	/**
	 * populates the cache with the current permissions
	 */
	async init() {
		if (this._initPromise) return this._initPromise;

		try {
			return await (this._initPromise = this.#init());
		} finally {
			this._initPromise = null;
		}
	}
	/**
	 * @internal
	 */
	async #init() {
		try {
			for (const guild of this.client.guilds.cache.values()) {
				const permissions = await guild.commands.permissions.fetch();

				if (!permissions.size) continue;

				for (const [commandId, _permissions] of permissions) {
					this.update({ id: commandId, permissions: _permissions, guildId: guild.id });
				}
			}

			this.ready = true;
		} catch (error) {
			logger.error(error, '[PERMISSIONS]');
			throw new Error('Error fetching command permissions');
		}
	}

	/**
	 * updates the cache
	 * @param data
	 */
	update({
		id: commandId,
		guildId,
		permissions,
	}: Pick<ClientEvents[Events.ApplicationCommandPermissionsUpdate][0], 'id' | 'guildId' | 'permissions'>) {
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
	 * @param guildId
	 * @param commandId
	 * @param member
	 */
	async assert(guildId: Snowflake, commandId: Snowflake, member: GuildMember) {
		if (!this.ready) await this.init();

		const permissions = this.cache.get(guildId)?.get(commandId);
		if (!permissions) {
			throw `unable to find permissions for \`${
				this.client.application!.commands.cache.get(commandId)?.name ?? commandId
			}\` in \`${this.client.guilds.cache.get(guildId)?.name ?? guildId}\``;
		}

		// users
		switch (permissions.users?.get(member.id)) {
			case true:
				return;

			case false:
				throw `you are explicitly denied access to the \`${
					this.client.application!.commands.cache.get(commandId)?.name ?? commandId
				}\` command`;
		}

		// roles
		let roleCache: Collection<Snowflake, Role> | undefined;

		if (permissions.roles.allowed) {
			roleCache = member.roles.cache;

			for (const roleId of permissions.roles.allowed) {
				if (roleCache.has(roleId)) return;
			}
		}

		if (permissions.roles.denied) {
			roleCache ??= member.roles.cache;

			for (const roleId of permissions.roles.denied) {
				if (roleCache.has(roleId)) {
					throw `the ${this.client.guilds.cache.get(guildId)?.roles.cache.get(roleId)?.name ?? roleId} role in \`${
						this.client.guilds.cache.get(guildId)?.name ?? guildId
					}\` is denied access to the \`${
						this.client.application!.commands.cache.get(commandId)?.name ?? commandId
					}\` command`;
				}
			}
		}
	}
}
