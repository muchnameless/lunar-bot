import { Collection } from 'discord.js';
import { compareAlphabetically } from '#functions';
import { BaseCommandCollection } from './BaseCommandCollection';
import type { BridgeCommand } from './BridgeCommand';
import type { DualCommand } from './DualCommand';

type BridgeCommandType = BridgeCommand | DualCommand;

export class BridgeCommandCollection<C extends BridgeCommandType = BridgeCommandType> extends BaseCommandCollection<C> {
	/**
	 * built-in methods will use this as the constructor
	 * that way BridgeCommandCollection#filter returns a standard Collection
	 */
	static override get [Symbol.species]() {
		return Collection;
	}

	/**
	 * returns all command categories
	 */
	get categories() {
		return [...new Set(this.map(({ category }) => category))];
	}

	/**
	 * returns all visible command categories
	 */
	get visibleCategories() {
		return this.categories
			.filter((category) => !BridgeCommandCollection.INVISIBLE_CATEGORIES.has(category!))
			.sort(compareAlphabetically);
	}

	/**
	 * returns the commands from the provided category
	 * @param categoryInput
	 */
	filterByCategory(categoryInput: string | null) {
		return this.filter(
			({ category, aliases }, name) =>
				category === categoryInput && !aliases?.some((alias) => alias.toLowerCase() === name),
		);
	}
}
