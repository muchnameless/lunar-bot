import { Collection, type Snowflake } from 'discord.js';
import { type BaseCommandCollection, type CommandType } from './BaseCommandCollection.js';
import { type LunarClient } from '#structures/LunarClient.js';
import { type HypixelGuild } from '#structures/database/models/HypixelGuild.js';

export interface CommandContext {
	category: string | null;
	client: LunarClient;
	collection: BaseCommandCollection;
	fileName: string;
}

export interface CommandData {
	/**
	 * command cooldown in milliseconds
	 */
	cooldown?: number | null;
	/**
	 * command name, defaults to the file name
	 */
	name?: string;
	/**
	 * function returning a Snowflake array
	 */
	requiredRoles?: RequiredRoles;
}

type RequiredRoles = (hypixelGuild: HypixelGuild) => Snowflake[];

export class BaseCommand {
	public declare readonly client: LunarClient<true>;

	public readonly collection: BaseCommandCollection;

	/**
	 * command name (lower case)
	 */
	public readonly name: string;

	/**
	 * command category, derived from the folder name
	 */
	public readonly category: string | null;

	/**
	 * null for a default, 0 for none
	 */
	public readonly cooldown: number | null;

	/**
	 * function to dynamically create a required roles array
	 */
	protected readonly _requiredRoles: RequiredRoles | null;

	/**
	 * user id -> last used timestamp, for cooldowns
	 */
	public timestamps: Collection<Snowflake, number> | null;

	/**
	 * command name aliases (lower case)
	 */
	public aliases: string[] | null = null;

	/**
	 * create a new command
	 *
	 * @param context
	 * @param data
	 */
	public constructor(
		{ client, collection, fileName, category }: CommandContext,
		{ name, cooldown, requiredRoles }: CommandData = {},
	) {
		Object.defineProperty(this, 'client', { value: client });

		this.collection = collection;
		this.name = (name ?? fileName).toLowerCase();
		this.category = category;

		this.cooldown = cooldown ?? null;
		this._requiredRoles = requiredRoles ?? null;
		this.timestamps = this.cooldown === 0 ? null : new Collection();
	}

	/**
	 * @param aliases
	 */
	protected static _parseAliases(aliases: string[] | undefined) {
		const parsed = aliases?.map((alias) => alias.toLowerCase()).filter(Boolean);
		return parsed?.length ? parsed : null;
	}

	/**
	 * client config
	 */
	public get config() {
		return this.client.config;
	}

	/**
	 * roles required to run this command
	 *
	 * @param hypixelGuild
	 */
	public requiredRoles(hypixelGuild?: HypixelGuild | null): Snowflake[] | null {
		if (!this._requiredRoles) return null;
		if (!hypixelGuild) throw 'unable to find a hypixel guild for role permissions';
		return this._requiredRoles(hypixelGuild);
	}

	/**
	 * clears the cooldown timestamps collection
	 */
	public clearCooldowns() {
		this.timestamps &&= new Collection();
		return this;
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	public load() {
		this.collection.set(this.name, this as unknown as CommandType);
		if (this.aliases) for (const alias of this.aliases) this.collection.set(alias, this as unknown as CommandType);
		return this;
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	public unload() {
		this.collection.delete(this.name);
		if (this.aliases) for (const alias of this.aliases) this.collection.delete(alias);
		return this;
	}
}
