'use strict';

const { GUILD_ID_BRIDGER, GUILD_ID_ERROR } = require('../../constants/database');
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

	/**
	 * `NameOne`|`NameTwo`|`NameThree`
	 */
	get guildNames() {
		return this.cache.map(hGuild => `\`${hGuild.name.replace(/ /g, '')}\``).join('|');
	}

	/**
	 * `-NameOne`|`-NameTwo`|`-NameThree`
	 */
	get guildNameFlags() {
		return this.cache.map(hGuild => `\`-${hGuild.name.replace(/ /g, '')}\``).join('|');
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
	 * sweeps the player cache
	 * @param {?string|import('./models/HypixelGuild')} idOrGuild
	 */
	sweepPlayerCache(idOrGuild) {
		if (idOrGuild) {
			if (typeof idOrGuild === 'string' && [ GUILD_ID_BRIDGER, GUILD_ID_ERROR ].includes(idOrGuild)) return;

			const hypixelGuild = this.resolve(idOrGuild);

			if (!hypixelGuild) throw new Error(`[SWEEP PLAYER CACHE]: invalid input: ${idOrGuild}`);

			return hypixelGuild.players = null;
		}

		return this.cache.each(hypixelGuild => hypixelGuild.players = null);
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
	 * @param {string[]} array message flags
	 * @returns {?import('./models/HypixelGuild')|boolean}
	 */
	getFromArray(array) {
		for (const element of array) {
			const hypixelGuild = this.getByName(element);

			if (hypixelGuild) return hypixelGuild;

			const { similarity } = autocorrect(element, [ 'all' ]);

			if (similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')) return false;
		}

		return null;
	}
}

module.exports = HypixelGuildHandler;
