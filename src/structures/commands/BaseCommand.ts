import { Collection } from 'discord.js';
import type { HypixelGuild } from '../database/models/HypixelGuild';
import type { Snowflake } from 'discord.js';
import type { LunarClient } from '../LunarClient';
import type { BaseCommandCollection, CommandType } from './BaseCommandCollection';

export interface CommandContext {
	client: LunarClient;
	collection: BaseCommandCollection;
	fileName: string;
	category: string | null;
}

export interface CommandData {
	/** command name, defaults to the file name */
	name?: string;
	/** command cooldown in milliseconds */
	cooldown?: number | null;
	/** function returning a Snowflake array */
	requiredRoles?: RequiredRoles;
}

type RequiredRoles = (hypixelGuild: HypixelGuild) => Snowflake[];

export class BaseCommand {
	client: LunarClient;
	collection: BaseCommandCollection;
	/**
	 * command name (lower case)
	 */
	name: string;
	/**
	 * command category, derived from the folder name
	 */
	category: string | null;
	/**
	 * null for a default, 0 for none
	 */
	cooldown: number | null;
	#requiredRoles: RequiredRoles | null;
	timestamps: Collection<Snowflake, number> | null;
	/** command name aliases (lower case) */
	aliases: string[] | null = null;

	/**
	 * create a new command
	 * @param context
	 * @param data
	 */
	constructor(
		{ client, collection, fileName, category }: CommandContext,
		{ name, cooldown, requiredRoles }: CommandData = {},
	) {
		this.client = client;
		this.collection = collection;
		this.name = (name ?? fileName).toLowerCase();
		this.category = category;

		this.cooldown = cooldown ?? null;
		this.#requiredRoles = requiredRoles ?? null;
		this.timestamps = this.cooldown !== 0 ? new Collection() : null;
	}

	/**
	 * client config
	 */
	get config() {
		return this.client.config;
	}

	/**
	 * roles required to run this command
	 */
	requiredRoles(hypixelGuild: HypixelGuild) {
		if (this.#requiredRoles) return this.#requiredRoles(hypixelGuild);

		switch (this.category) {
			case 'staff':
			case 'moderation':
				return hypixelGuild.roleIds.STAFF_IDS;

			case 'tax':
			case 'manager':
				return hypixelGuild.roleIds.ADMIN_IDS;

			default:
				return null;
		}
	}

	/**
	 * clears the cooldown timestamps collection
	 */
	clearCooldowns() {
		this.timestamps &&= new Collection();
		return this;
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	load() {
		this.collection.set(this.name, this as unknown as CommandType);
		if (this.aliases) for (const alias of this.aliases) this.collection.set(alias, this as unknown as CommandType);
		return this;
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	unload() {
		this.collection.delete(this.name);
		if (this.aliases) for (const alias of this.aliases) this.collection.delete(alias);
		return this;
	}
}
