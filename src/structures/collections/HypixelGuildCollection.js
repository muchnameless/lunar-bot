'use strict';

const { autocorrect } = require('../../functions/util');
const logger = require('../../functions/logger');
const BaseClientCollection = require('./BaseClientCollection');


class HypixelGuildCollection extends BaseClientCollection {
	constructor(client, entries = null) {
		super(client, entries);
	}

	/**
	 * update all guilds
	 * @returns {Promise<boolean>} success
	 */
	async update() {
		try {
			for (const [ , hypixelGuild ] of this) {
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
	 */
	getByName(name) {
		if (!name) return null;

		const result = autocorrect(name, this, 'name');

		return (result.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD'))
			? result.value
			: null;
	}
}

module.exports = HypixelGuildCollection;
