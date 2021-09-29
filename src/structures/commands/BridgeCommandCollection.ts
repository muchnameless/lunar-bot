import { Collection } from 'discord.js';
import { compareAlphabetically, logger } from '../../functions';
import { BaseCommandCollection } from './BaseCommandCollection';
import type { BridgeCommand } from './BridgeCommand';
import type { DualCommand } from './DualCommand';
import type { HypixelMessage } from '../chat_bridge/HypixelMessage';


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
		return [ ...new Set(this.map(({ category }) => category)) ];
	}

	/**
	 * returns all visible command categories
	 */
	get visibleCategories() {
		return this.categories
			.filter(category => !BridgeCommandCollection.INVISIBLE_CATEGORIES.includes(category))
			.sort(compareAlphabetically);
	}

	/**
	 * help command run method
	 * @param hypixelMessage
	 */
	async help(hypixelMessage: HypixelMessage) {
		try {
			return await this.get('help')?.runMinecraft(hypixelMessage);
		} catch (error) {
			logger.error(`[CMD HANDLER]: An error occured while ${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}'`, error);
			return hypixelMessage.author.send(`an error occured while executing the \`help\` command:\n${error}`);
		}
	}

	/**
	 * returns the commands from the provided category
	 * @param categoryInput
	 */
	filterByCategory(categoryInput: string) {
		return this.filter(({ category, aliases }, name) => category === categoryInput && !aliases?.some(alias => alias.toLowerCase() === name));
	}
}
