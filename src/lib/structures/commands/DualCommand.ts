import type { ParseArgsConfig } from 'node:util';
import type { Awaitable } from 'discord.js';
import { ApplicationCommand, type ApplicationCommandData } from './ApplicationCommand.js';
import type { CommandContext } from './BaseCommand.js';
import { BaseCommandCollection } from './BaseCommandCollection.js';
import type { BridgeCommand, BridgeCommandData } from './BridgeCommand.js';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage.js';

export abstract class DualCommand
	extends ApplicationCommand
	implements Omit<BridgeCommand, 'clearCooldowns' | 'collection' | 'commandId' | 'load' | 'unload'>
{
	private _usage: string | (() => string) | null = null;

	public readonly aliasesInGame: string[] | null;

	public readonly guildOnly: boolean;

	public readonly args: boolean | number = false;

	public readonly parseArgsOptions?: ParseArgsConfig['options'];

	/**
	 * create a new command
	 *
	 * @param context
	 * @param slashData
	 * @param bridgeData
	 */
	public constructor(
		context: CommandContext,
		slashData: ApplicationCommandData,
		{ aliases, guildOnly, args, parseArgsOptions, usage }: BridgeCommandData = {},
	) {
		super(context, slashData);

		this.aliasesInGame = DualCommand._parseAliases(aliases);
		this.guildOnly = guildOnly ?? false;
		this.args = args ?? false;
		this.parseArgsOptions = parseArgsOptions;
		this.usage = usage ?? null;
	}

	/**
	 * whether the command is part of a visible category
	 */
	public get visible() {
		return !BaseCommandCollection.INVISIBLE_CATEGORIES.has(this.category);
	}

	public get description() {
		return this.slash?.description ?? null;
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
		this._usage = typeof value === 'function' || value ? value : null;
	}

	/**
	 * prefix name usage
	 */
	public get usageInfo() {
		return `\`${this.config.get('PREFIXES')[0]}${
			this.aliasesInGame?.[0]!.length ?? Number.POSITIVE_INFINITY < this.name.length
				? this.aliasesInGame![0]
				: this.name
		}\` ${this.usage}`;
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	public override load() {
		// load into chatbridge command collection
		this.client.chatBridges.commands.set(this.name.toLowerCase(), this);
		if (this.aliasesInGame) {
			for (const alias of this.aliasesInGame) {
				this.client.chatBridges.commands.set(alias.toLowerCase(), this);
			}
		}

		// load into slash commands collection
		return super.load();
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	public override unload() {
		// unload from chatbridge command collection
		this.client.chatBridges.commands.delete(this.name.toLowerCase());
		if (this.aliasesInGame) {
			for (const alias of this.aliasesInGame) {
				this.client.chatBridges.commands.delete(alias.toLowerCase());
			}
		}

		// unload from slash commands collection
		return super.unload();
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
