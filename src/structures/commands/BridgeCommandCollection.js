'use strict';

const { Collection } = require('discord.js');
const { autocorrect } = require('../../functions/util');
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
	async help(message, ...args) {
		try {
			return await this.get('help').run(message, ...args);
		} catch (error) {
			logger.error(`[CMD HANDLER]: An error occured while ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute ${message.content} in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'}`, error);
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

	/**
	 * get a command by name or by alias
	 * @param {string} name
	 * @returns {?import('./BridgeCommand')}
	 */
	getByName(name) {
		/**
		 * @type {?import('./BridgeCommand')}
		 */
		let command = this.get(name);
		if (command) return command;

		// don't autocorrect single letters
		if (name.length <= 1) return null;

		// autocorrect input
		const { value, similarity } = autocorrect(name, this.keyArray().filter(({ length }) => length > 1));
		if (similarity < this.client.config.get('AUTOCORRECT_THRESHOLD')) return null;

		// return command if it is visible
		command = this.get(value);
		return command.visible ? command : null;
	}
};
