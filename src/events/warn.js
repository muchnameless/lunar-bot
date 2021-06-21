'use strict';

const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class WarnEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {string} warning
	 */
	async run(warning) {
		logger.warn(warning);
	}
};
