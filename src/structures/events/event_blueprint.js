'use strict';

const Event = require('../structures/events/Event');
// const logger = require('../functions/logger');


module.exports = class MyEvent extends Event {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 */
	async run() {
		// do stuff
	}
};
