'use strict';

/**
 * @typedef {object} EventData
 * @property {boolean} once
 * @property {boolean} enabled
 */

module.exports = class Event {
	/**
	 * @param {{ client: import('../LunarClient'), name: string }} param0
	 * @param {EventData} param1
	 */
	constructor({ client, name }, { once, enabled }) {
		this.client = client;
		this.name = name;

		this.once = once ?? false;
		this.enabled = enabled ?? true;

		this.callback = this.run.bind(this);
	}

	/**
	 * client config
	 */
	get config() {
		return this.client.config;
	}

	/**
	 * add the event listener
	 * @param {boolean} [force=false] wether to also load disabled events
	 */
	load(force = false) {
		if (this.enabled || force) this.client[this.once ? 'once' : 'on'](this.name, this.callback);
	}

	/**
	 * remove the event listener
	 */
	unload() {
		this.client.off(this.name, this.callback);
	}

	/**
	 * event listener callback
	 */
	async run() {
		throw new Error('no run function specified');
	}
};
