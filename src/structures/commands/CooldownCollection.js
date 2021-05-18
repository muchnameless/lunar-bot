'use strict';

const { Collection } = require('discord.js');
const logger = require('../../functions/logger');


module.exports = class CooldownCollection extends Collection {
	/**
	 * returns the timestamps collection for the command
	 * @param {string} commandName
	 * @returns {Collection<import('discord-api-types/v8').Snowflake, number>}
	 */
	get(commandName) {
		logger.debug(commandName)
		return super.get(commandName) ?? (() => {
			logger.debug('NEW')
			const timestamps = new Collection();
			this.set(commandName, timestamps);
			return timestamps;
		})();
	}
};
