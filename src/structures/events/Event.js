'use strict';

const BaseEvent = require('./BaseEvent');

module.exports = class Event extends BaseEvent {
	/**
	 * client
	 * @returns {import('../LunarClient')}
	 */
	get client() {
		return this.emitter;
	}
};
