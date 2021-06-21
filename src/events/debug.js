'use strict';

const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class DebugEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: false,
		});
	}

	/**
	 * event listener callback
	 * @param {string} info
	 */
	async run(info) {
		logger.debug(info);
	}
};
