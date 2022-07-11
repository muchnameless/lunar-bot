import { BaseCommand } from './BaseCommand';
import { BaseCommandCollection } from './BaseCommandCollection';
import type { Awaitable } from '@sapphire/utilities';
import type { CommandContext, CommandData } from './BaseCommand';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';
import type { BridgeCommandCollection } from './BridgeCommandCollection';

export interface BridgeCommandData extends CommandData {
	aliases?: string[];
	description?: string;
	guildOnly?: boolean;
	args?: number | boolean;
	usage?: string | (() => string);
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
	constructor(context: CommandContext, { aliases, description, guildOnly, args, usage, ...data }: BridgeCommandData) {
		super(context, data);

		this.aliases = aliases?.map((alias) => alias.toLowerCase()).filter(Boolean) || null;
		this.description = description || null;
		this.guildOnly = guildOnly ?? false;
		this.args = args ?? false;
		this.usage = usage ?? null;
	}

	/**
	 * @param value
	 */
	set usage(value: string | (() => string) | null) {
		this._usage = typeof value === 'function' || value?.length ? value : null;
	}

	/**
	 * @returns command argument usage
	 */
	get usage(): string | null {
		return typeof this._usage === 'function' ? this._usage() : this._usage;
	}

	/**
	 * prefix name usage
	 */
	get usageInfo() {
		return `\`${this.config.get('PREFIXES')[0]}${
			this.aliases?.[0]!.length ?? Number.POSITIVE_INFINITY < this.name.length ? this.aliases![0] : this.name
		}\` ${this.usage}`;
	}

	/**
	 * whether the command is part of a visible category
	 */
	get visible() {
		return !BaseCommandCollection.INVISIBLE_CATEGORIES.has(this.category!);
	}

	/* eslint-disable @typescript-eslint/no-unused-vars */

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	minecraftRun(hypixelMessage: HypixelUserMessage): Awaitable<unknown> {
		throw new Error('no run function specified for minecraft');
	}

	/* eslint-enable @typescript-eslint/no-unused-vars */
}
