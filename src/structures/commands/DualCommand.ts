import { ApplicationCommand } from './ApplicationCommand';
import { BaseCommandCollection } from './BaseCommandCollection';
import type { CommandContext } from './BaseCommand';
import type { ApplicationCommandData } from './ApplicationCommand';
import type { BridgeCommand, BridgeCommandData } from './BridgeCommand';
import type { HypixelUserMessage } from '../chat_bridge/HypixelMessage';

export class DualCommand
	extends ApplicationCommand
	implements Omit<BridgeCommand, 'collection' | 'load' | 'unload' | 'clearCooldowns'>
{
	_usage: string | (() => string) | null = null;
	aliasesInGame: string[] | null;
	guildOnly: boolean;
	args: number | boolean | null;

	/**
	 * create a new command
	 * @param context
	 * @param slashData
	 * @param bridgeData
	 */
	constructor(
		context: CommandContext,
		slashData: ApplicationCommandData,
		{ aliases, guildOnly, args, usage }: BridgeCommandData = {},
	) {
		super(context, slashData);

		this.aliasesInGame = aliases?.map((alias) => alias.toLowerCase()).filter(Boolean) || null;
		this.guildOnly = guildOnly ?? false;
		this.args = args ?? false;
		this.usage = usage ?? null;
	}

	/**
	 * whether the command is part of a visible category
	 */
	get visible() {
		return !BaseCommandCollection.INVISIBLE_CATEGORIES.has(this.category!);
	}

	get description() {
		return this.slash?.description ?? null;
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
			this.aliasesInGame?.[0]!.length ?? Number.POSITIVE_INFINITY < this.name.length
				? this.aliasesInGame![0]
				: this.name
		}\` ${this.usage}`;
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	override load() {
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
	override unload() {
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

	/* eslint-disable @typescript-eslint/no-unused-vars */

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	minecraftRun(hypixelMessage: HypixelUserMessage): unknown | Promise<unknown> {
		throw new Error('no run function specified for minecraft');
	}

	/* eslint-enable @typescript-eslint/no-unused-vars */
}
