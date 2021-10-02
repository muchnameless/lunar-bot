import { Collection } from 'discord.js';
import type { Snowflake } from 'discord.js';
import type { LunarClient } from '../LunarClient';
import type { BaseCommandCollection, CommandType } from './BaseCommandCollection';


export interface CommandContext {
	client: LunarClient;
	collection: BaseCommandCollection;
	name: string;
	category: string | null;
}

export type RequiredRoles = () => Snowflake[];


export class BaseCommand {
	client: LunarClient;
	collection: BaseCommandCollection;
	name: string;
	category: string | null;
	cooldown: number | null;
	_requiredRoles: RequiredRoles | null;
	timestamps: Collection<Snowflake, number> | null;
	aliases: string[] | null = null;

	/**
	 * create a new command
	 * @param context
	 * @param param1
	 */
	constructor({ client, collection, name, category }: CommandContext, { cooldown, requiredRoles }: { cooldown?: number | null, requiredRoles?: RequiredRoles } = {}) {
		this.client = client;
		this.collection = collection;
		this.name = name;
		this.category = category;

		this.cooldown = cooldown ?? null;
		this._requiredRoles = requiredRoles ?? null;
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
		if (this._requiredRoles) return this._requiredRoles();

		switch (this.category) {
			case 'staff':
			case 'moderation':
				return [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ] as Snowflake[];

			case 'tax':
			case 'manager':
				return [ this.config.get('MANAGER_ROLE_ID') ] as Snowflake[];

			case 'guild':
				return null;

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
