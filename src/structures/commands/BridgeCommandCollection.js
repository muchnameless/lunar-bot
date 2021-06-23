'use strict';

const { Collection } = require('discord.js');
const BaseCommandCollection = require('./BaseCommandCollection');
const logger = require('../../functions/logger');


module.exports = class BridgeCommandCollection extends BaseCommandCollection {
	/**
	 * categories that are excluded from the help command and autocorrection
	 */
	static INVISIBLE_CATEGORIES = [ 'hidden', 'owner' ];

	/**
	 * command flags to change certain behaviours
	 */
	static FORCE_FLAGS = [ 'f', 'force' ];

	/**
	 * checks wether the array includes any of the FORCE_FLAGS
	 * @param {string[]} array
	 */
	static force(array) {
		return array.some(x => BridgeCommandCollection.FORCE_FLAGS.includes(x));
	}

	/**
	 * built-in methods will use this as the constructor
	 * that way BridgeCommandCollection#filter returns a standard Collection
	 */
	static get [Symbol.species]() {
		return Collection;
	}

	static get forceFlagsAsFlags() {
		return this.FORCE_FLAGS.map(flag => `\`-${flag}\``).join('|');
	}

	/**
	 * returns all non-hidden commands
	 */
	get visible() {
		return this.filter(({ category }) => !BridgeCommandCollection.INVISIBLE_CATEGORIES.includes(category));
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
	async help(message, args) {
		try {
			return await this.get('help').runInGame(message, args);
		} catch (error) {
			logger.error(`[CMD HANDLER]: An error occured while ${message.author.ign} tried to execute '${message.content}' in '${message.type}'`, error);
			message.reply(`an error occured while executing the \`help\` command:\n${error}`);
		}
	}

	/**
	 * returns the commands from the provided category
	 * @param {string} categoryInput
	 */
	filterByCategory(categoryInput) {
		return this.filter((/** @type {import('./BridgeCommand')} */ { category, aliases }, name) => category === categoryInput && !aliases?.some(alias => alias.toLowerCase() === name));
	}
};
