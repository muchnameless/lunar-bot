import { Collection } from 'discord.js';
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
	name?: string;
	cooldown?: number | null;
	/** function returning a Snowflake array */
	requiredRoles?: RequiredRoles;
}

type RequiredRoles = () => Snowflake[];


export class BaseCommand {
	client: LunarClient;
	collection: BaseCommandCollection;
	/**
	 * command name
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
	aliases: string[] | null = null;

	/**
	 * create a new command
	 * @param context
	 * @param param1
	 */
	constructor({ client, collection, fileName, category }: CommandContext, { name, cooldown, requiredRoles }: CommandData = {}) {
		this.client = client;
		this.collection = collection;
		this.name = name ?? fileName;
		this.category = category;

		this.cooldown = cooldown ?? null;
		this.#requiredRoles = requiredRoles ?? null;
		this.timestamps = this.cooldown !== 0
			? new Collection()
			: null;
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
	get requiredRoles() {
		if (this.#requiredRoles) return this.#requiredRoles();

		switch (this.category) {
			case 'staff':
			case 'moderation':
				return [
					this.config.get('SHRUG_ROLE_ID'),
					this.config.get('TRIAL_MODERATOR_ROLE_ID'),
					this.config.get('MODERATOR_ROLE_ID'),
					this.config.get('DANKER_STAFF_ROLE_ID'),
					this.config.get('SENIOR_STAFF_ROLE_ID'),
					this.config.get('MANAGER_ROLE_ID'),
				];

			case 'tax':
			case 'manager':
				return [ this.config.get('MANAGER_ROLE_ID') ];

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
		this.collection.set(this.name.toLowerCase(), this as unknown as CommandType);
		if (this.aliases) for (const alias of this.aliases) this.collection.set(alias.toLowerCase(), this as unknown as CommandType);
		return this;
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	unload() {
		this.collection.delete(this.name.toLowerCase());
		if (this.aliases) for (const alias of this.aliases) this.collection.delete(alias.toLowerCase());
		return this;
	}
}
