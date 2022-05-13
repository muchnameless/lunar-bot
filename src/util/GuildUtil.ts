import { logger } from '../logger';
import type { Role, Collection, Guild, GuildMember, Snowflake } from 'discord.js';

export type RoleCollection = Collection<Snowflake, Role>;
export type RoleResolvables = (Snowflake | Role | null)[] | RoleCollection;

export class GuildUtil extends null {
	/**
	 * cache
	 */
	static fetchAllMembersCache = new Map<Snowflake, Promise<Collection<Snowflake, GuildMember>>>();

	/**
	 * @param guild
	 */
	static logInfo(guild: Guild) {
		return {
			guildId: guild.id,
			guildName: guild.name,
			memberCount: guild.memberCount,
			memberCacheSize: guild.members.cache.size,
		};
	}

	/**
	 * verifies the roles via guild.roles.cache and sorts them by position, array -> collection
	 * @param guild
	 * @param rolesOrIds roles or role ids to verify
	 */
	static resolveRoles(guild: Guild, rolesOrIds: RoleResolvables) {
		const resolvedRoles = new Set<Role>();

		let highest: Role;

		for (const roleOrId of rolesOrIds.values()) {
			// skip invalid input
			if (!roleOrId) continue;

			const role = guild.roles.resolve(roleOrId);

			if (!role) {
				logger.warn({ ...this.logInfo(guild), data: roleOrId }, '[GUILD RESOLVE ROLES]: not a valid role id');
				continue;
			}

			if (role.managed || guild.roles.comparePositions(role, (highest ??= guild.members.me!.roles.highest)) >= 0) {
				logger.warn({ ...this.logInfo(guild), data: role }, '[GUILD RESOLVE ROLES]: missing permissions to edit');
				continue;
			}

			resolvedRoles.add(role);
		}

		return [...resolvedRoles].sort((a, b) => guild.roles.comparePositions(b, a));
	}

	/**
	 * tries to find a discord member by a discord tag
	 * @param guild
	 * @param tagInput
	 */
	static async fetchMemberByTag(guild: Guild | null, tagInput: string) {
		if (!guild?.available) {
			if (guild) {
				logger.warn(
					{ ...this.logInfo(guild), data: tagInput },
					`[GUILD FETCH MEMBER BY TAG]: ${tagInput}: guild '${guild.name}' unavailable`,
				);
				return null;
			}

			logger.warn({ guild, data: tagInput }, `[GUILD FETCH MEMBER BY TAG]: ${tagInput}: guild 'uncached'`);
			return null;
		}

		if (guild.members.cache.size === guild.memberCount) {
			return guild.members.cache.find(({ user: { tag } }) => tag === tagInput) ?? null;
		}

		try {
			return (
				(await guild.members.fetch({ query: tagInput.replace(/#\d{4}$/, ''), limit: 100 })).find(
					({ user: { tag } }) => tag === tagInput,
				) ?? null
			);
		} catch (error) {
			logger.error({ ...this.logInfo(guild), err: error, data: tagInput }, `[GUILD FETCH MEMBER BY TAG]: ${tagInput}`);
			return null;
		}
	}

	/**
	 * fetches all guild members if the cache size is not equal to the guild's member count
	 * @param guild
	 */
	static async fetchAllMembers(guild: Guild | null) {
		if (!guild?.available) throw `the ${guild?.name ?? 'discord'} server is currently unavailable`;

		if (guild.memberCount === guild.members.cache.size) {
			logger.debug(this.logInfo(guild), '[GUILD FETCH ALL MEMBERS]: already cached');
			return guild.members.cache;
		}

		const cached = this.fetchAllMembersCache.get(guild.id);
		if (cached) return cached;

		const promise = guild.members.fetch();
		this.fetchAllMembersCache.set(guild.id, promise);

		try {
			return await promise;
		} finally {
			this.fetchAllMembersCache.delete(guild.id);
		}
	}
}
