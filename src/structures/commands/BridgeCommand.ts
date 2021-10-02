import { BaseCommand } from './BaseCommand';
import { BaseCommandCollection } from './BaseCommandCollection';
import type { CommandContext, RequiredRoles } from './BaseCommand';
import type { HypixelMessage } from '../chat_bridge/HypixelMessage';
import type { BridgeCommandCollection } from './BridgeCommandCollection';


export interface BridgeCommandData {
	aliases?: string[],
	description?: string,
	guildOnly?: boolean,
	args?: number | boolean,
	usage?: string | (() => string),
	cooldown?: number,
	requiredRoles?: RequiredRoles,
}


export class BridgeCommand extends BaseCommand {
	_usage: string | (() => string) | null = null;
	description: string | null;
	guildOnly = false;
	args: number | boolean | null;
	declare collection: BridgeCommandCollection;

	/**
	 * create a new command
	 * @param context
	 * @param data
	 */
	constructor(context: CommandContext, { aliases, description, guildOnly, args, usage, cooldown, requiredRoles }: BridgeCommandData) {
		super(context, { cooldown, requiredRoles });

		this.aliases = aliases?.filter(Boolean).length
			? aliases.filter(Boolean)
			: null;
		this.description = description || null;
		this.guildOnly = guildOnly ?? false;
		this.args = args ?? false;
		this.usage = usage ?? null;
	}

	/**
	 * @param value
	 */
	set usage(value: string | (() => string) | null) {
		this._usage = typeof value === 'function' || value?.length
			? value
			: null;
	}

	/**
	 * @returns command argument usage
	 */
	get usage(): string | null {
		return typeof this._usage === 'function'
			? this._usage()
			: this._usage;
	}

	/**
	 * prefix name usage
	 */
	get usageInfo() {
		return `\`${this.config.get('PREFIXES')[0]}${this.aliases?.[0].length ?? Number.POSITIVE_INFINITY < this.name.length ? this.aliases![0] : this.name}\` ${this.usage}`;
	}

	/**
	 * wether the command is part of a visible category
	 */
	get visible() {
		return !BaseCommandCollection.INVISIBLE_CATEGORIES.includes(this.category!);
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	runMinecraft(hypixelMessage: HypixelMessage<true>): unknown;
	async runMinecraft(hypixelMessage: HypixelMessage<true>) { // eslint-disable-line @typescript-eslint/no-unused-vars, require-await
		throw new Error('no run function specified');
	}
}
