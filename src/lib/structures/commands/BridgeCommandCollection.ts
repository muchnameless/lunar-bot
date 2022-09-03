import { Collection } from 'discord.js';
import { BaseCommandCollection } from './BaseCommandCollection.js';
import { type BridgeCommand } from './BridgeCommand.js';
import { type DualCommand } from './DualCommand.js';
import { compareAlphabetically } from '#functions';

type BridgeCommandType = BridgeCommand | DualCommand;

export class BridgeCommandCollection<C extends BridgeCommandType = BridgeCommandType> extends BaseCommandCollection<C> {
	/**
	 * built-in methods will use this as the constructor
	 * that way BridgeCommandCollection#filter returns a standard Collection
	 */
	public static override get [Symbol.species]() {
		return Collection;
	}

	/**
	 * returns all command categories
	 */
	public get categories() {
		return [...new Set(this.map(({ category }) => category))];
	}

	/**
	 * returns all visible command categories
	 */
	public get visibleCategories() {
		return this.categories
			.filter((category) => !BridgeCommandCollection.INVISIBLE_CATEGORIES.has(category!))
			.sort(compareAlphabetically);
	}

	/**
	 * returns the commands from the provided category
	 *
	 * @param categoryInput
	 */
	public filterByCategory(categoryInput: string | null) {
		return this.filter(
			({ category, aliases }, name) =>
				category === categoryInput && !aliases?.some((alias) => alias.toLowerCase() === name),
		);
	}
}
