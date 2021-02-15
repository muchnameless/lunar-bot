'use strict';

const { autocorrect } = require('../../functions/util');
const ModelHandler = require('./ModelHandler');
const logger = require('../../functions/logger');


class HypixelGuildHandler extends ModelHandler {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('./models/HypixelGuild')}
		 */
		this.cache;
		/**
		 * @type {import('./models/HypixelGuild')}
		 */
		this.model;
	}

	async loadCache(condition) {
		await super.loadCache(condition);

		this.cache.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
	}

	/**
	 * update all guilds
	 * @returns {Promise<boolean>} success
	 */
	async update() {
		try {
			for (const hypixelGuild of this.cache.values()) {
				await hypixelGuild.update();
			}

			return true;
		} catch (error) {
			logger.error(`[UPDATE GUILD PLAYERS]: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`);
			return false;
		}
	}

	/**
	 * get a hypixel guild by its name, case insensitive and with auto-correction
	 * @param {string} name name of the hypixel guild
	 * @returns {?import('./models/HypixelGuild')}
	 */
	getByName(name) {
		if (!name) return null;

		const result = autocorrect(name, this.cache, 'name');

		return (result.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD'))
			? result.value
			: null;
	}

	/**
	 * autocorrect all flags to the hypixel guilds names and returns the most likely math or null, or 'false' for the 'all'-flag
	 * @param {string[]} flags message flags
	 * @returns {?import('./models/HypixelGuild')|boolean}
	 */
	getFromFlags(flags) {
		for (const flag of flags) {
			const hypixelGuild = this.getByName(flag);

			if (hypixelGuild) return hypixelGuild;

			const { similarity } = autocorrect(flag, [ 'all' ]);

			if (similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')) return false;
		}

		return null;
	}
}

module.exports = HypixelGuildHandler;
