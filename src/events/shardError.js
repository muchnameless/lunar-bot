'use strict';

const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class ShardErrorEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {Error} error
	 * @param {number} shardID
	 */
	async run(error, shardID) {
		logger.error(`[SHARD ERROR]: #${shardID}`, error);
	}
};
