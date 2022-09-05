import { type ParseArgsConfig } from 'node:util';
import { type Awaitable } from 'discord.js';
import { BaseCommand, type CommandContext, type CommandData } from './BaseCommand.js';
import { BaseCommandCollection } from './BaseCommandCollection.js';
import { type BridgeCommandCollection } from './BridgeCommandCollection.js';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';

export interface BridgeCommandData extends CommandData {
	aliases?: string[];
	args?: boolean | number;
	description?: string;
	guildOnly?: boolean;
	parseArgsOptions?: ParseArgsConfig['options'];
	usage?: string | (() => string);
}

export class BridgeCommand extends BaseCommand {
	private _usage: string | (() => string) | null = null;

	public readonly description: string | null;

	public readonly guildOnly: boolean = false;

	public readonly args: boolean | number = false;

	public readonly parseArgsOptions?: ParseArgsConfig['options'];

	public declare readonly collection: BridgeCommandCollection;

	/**
	 * create a new command
	 *
	 * @param context
	 * @param data
	 */
	public constructor(
		context: CommandContext,
		{ aliases, description, guildOnly, args, parseArgsOptions, usage, ...data }: BridgeCommandData,
	) {
		super(context, data);

		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		this.aliases = aliases?.map((alias) => alias.toLowerCase()).filter(Boolean) || null;
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		this.description = description || null;
		this.guildOnly = guildOnly ?? false;
		this.args = args ?? false;
		this.parseArgsOptions = parseArgsOptions;
		this.usage = usage ?? null;
	}

	/**
	 * @returns command argument usage
	 */
	public get usage(): string | null {
		return typeof this._usage === 'function' ? this._usage() : this._usage;
	}

	/**
	 * @param value
	 */
	public set usage(value: string | (() => string) | null) {
		this._usage = typeof value === 'function' || value?.length ? value : null;
	}

	/**
	 * prefix name usage
	 */
	public get usageInfo() {
		return `\`${this.config.get('PREFIXES')[0]}${
			this.aliases?.[0]!.length ?? Number.POSITIVE_INFINITY < this.name.length ? this.aliases![0] : this.name
		}\` ${this.usage}`;
	}

	/**
	 * whether the command is part of a visible category
	 */
	public get visible() {
		return !BaseCommandCollection.INVISIBLE_CATEGORIES.has(this.category!);
	}

	/**
	 * discord application command id (null for this type of command)
	 */
	// eslint-disable-next-line @typescript-eslint/class-literal-property-style
	public get commandId() {
		return null;
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public minecraftRun(hypixelMessage: HypixelUserMessage): Awaitable<unknown> {
		throw new Error('no run function specified for minecraft');
	}
}
