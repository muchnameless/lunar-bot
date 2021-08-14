import { Collection } from 'discord.js';
import { BaseCommandCollection } from './BaseCommandCollection.js';
import { logger } from '../../functions/logger.js';


export class BridgeCommandCollection extends BaseCommandCollection {
	/**
	 * categories that are excluded from the help command and autocorrection
	 */
	static INVISIBLE_CATEGORIES = [ 'hidden', 'owner' ];

	/**
	 * built-in methods will use this as the constructor
	 * that way BridgeCommandCollection#filter returns a standard Collection
	 */
	static get [Symbol.species]() {
		return Collection;
	}

	/**
	 * returns all command categories
	 * @returns {string[]}
	 */
	get categories() {
		return [ ...new Set(this.map(({ category }) => category)) ];
	}

	/**
	 * returns all visible command categories
	 */
	get visibleCategories() {
		return this.categories.filter(category => !BridgeCommandCollection.INVISIBLE_CATEGORIES.includes(category)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
	}

	/**
	 * help command run method
	 * @type {Function}
	 */
	async help(message) {
		try {
			return await this.get('help').runInGame(message);
		} catch (error) {
			logger.error(`[CMD HANDLER]: An error occured while ${message.author} tried to execute '${message.content}' in '${message.type}'`, error);
			message.reply(`an error occured while executing the \`help\` command:\n${error}`);
		}
	}

	/**
	 * returns the commands from the provided category
	 * @param {string} categoryInput
	 */
	filterByCategory(categoryInput) {
		return this.filter((/** @type {import('./BridgeCommand').BridgeCommand} */ { category, aliases }, name) => category === categoryInput && !aliases?.some(alias => alias.toLowerCase() === name));
	}
}
