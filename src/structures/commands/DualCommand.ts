import { SlashCommand } from './SlashCommand';
import type { CommandContext } from './BaseCommand';
import type { SlashCommandData } from './SlashCommand';
import type { BridgeCommandData } from './BridgeCommand';
import type { HypixelMessage } from '../chat_bridge/HypixelMessage';


export class DualCommand extends SlashCommand {
	_usage: string | (() => string) | null;
	aliasesInGame: string[] | null;
	guildOnly: boolean;
	args: number | boolean | null;

	/**
	 * create a new command
	 * @param context
	 * @param data
	 * @param param2
	 */
	constructor(context: CommandContext, data: SlashCommandData, { aliases, guildOnly, args, usage }: BridgeCommandData = {}) {
		super(context, data);

		this._usage = null;

		this.aliasesInGame = aliases?.length
			? aliases.filter(Boolean)
			: null;
		this.guildOnly = guildOnly ?? false;
		this.args = args ?? false;
		this.usage = usage ?? null;
	}

	/**
	 * wether the command is part of a visible category
	 */
	get visible() {
		return !this.collection.constructor.INVISIBLE_CATEGORIES.includes(this.category);
	}

	get description() {
		return this.slash.description;
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
		return `\`${this.config.get('PREFIXES') as string[][0]}${this.aliasesInGame?.[0].length ?? Number.POSITIVE_INFINITY < this.name.length ? this.aliasesInGame![0] : this.name}\` ${this.usage}`;
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	override load() {
		// load into slash commands collection
		super.load();

		// load into chatbridge command collection
		this.client.chatBridges.commands.set(this.name.toLowerCase(), this);
		this.aliasesInGame?.forEach(alias => this.client.chatBridges.commands.set(alias.toLowerCase(), this));
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	override unload() {
		// unload from slash commands collection
		super.unload();

		// unload from chatbridge command collection
		this.client.chatBridges.commands.delete(this.name.toLowerCase());
		this.aliasesInGame?.forEach(alias => this.client.chatBridges.commands.delete(alias.toLowerCase()));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	async runMinecraft(hypixelMessage: HypixelMessage) { // eslint-disable-line @typescript-eslint/no-unused-vars
		throw new Error('no run function specified');
	}
}
