import { ApplicationCommandPermissionType, Collection } from 'discord.js';
import { logger } from '#logger';
import { assertNever } from '#functions';
import { missingPermissionsError } from '../errors/MissingPermissionsError';
import type { ClientEvents, Events, GuildMember, Snowflake, Role } from 'discord.js';
import type { LunarClient } from '../LunarClient';

interface AllowedDenied {
	allowed: Set<Snowflake> | null;
	denied: Set<Snowflake> | null;
}
interface CommandPermissions {
	users: AllowedDenied;
	roles: AllowedDenied;
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
			return await (this._initPromise = this._init());
		} finally {
			this._initPromise = null;
		}
	}
	private async _init() {
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
			users: {
				allowed: null,
				denied: null,
			},
			roles: {
				allowed: null,
				denied: null,
			},
		};

		for (const { id, type, permission } of permissions) {
			const key = permission ? 'allowed' : 'denied';

			switch (type) {
				case ApplicationCommandPermissionType.Channel:
					continue;

				case ApplicationCommandPermissionType.Role:
					if (parsedPerms.roles[key]) {
						parsedPerms.roles[key]!.add(id);
					} else {
						parsedPerms.roles[key] = new Set([id]);
					}
					break;

				case ApplicationCommandPermissionType.User:
					if (parsedPerms.users[key]) {
						parsedPerms.users[key]!.add(id);
					} else {
						parsedPerms.users[key] = new Set([id]);
					}
					break;

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
		if (!permissions) throw missingPermissionsError();

		if (permissions.users.allowed?.has(member.id)) return;
		if (permissions.users.denied?.has(member.id)) throw missingPermissionsError();

		let roleCache: Collection<Snowflake, Role> | undefined;

		if (
			permissions.roles.allowed &&
			(roleCache = member.roles.cache).some(({ id }) => permissions.roles.allowed!.has(id))
		) {
			return;
		}
		if (
			permissions.roles.denied &&
			(roleCache ?? member.roles.cache).some(({ id }) => permissions.roles.denied!.has(id))
		) {
			throw missingPermissionsError();
		}
	}
}
