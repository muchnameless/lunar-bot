'use strict';

const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class ErrorEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 * @param {Error} error
	 */
	run(error) {
		logger.error('[CLIENT ERROR]', error);
	}
};
