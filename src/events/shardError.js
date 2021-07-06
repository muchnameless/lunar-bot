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
	 * @param {number} shardId
	 */
	async run(error, shardId) {
		logger.error(`[SHARD ERROR]: #${shardId}`, error);
	}
};
