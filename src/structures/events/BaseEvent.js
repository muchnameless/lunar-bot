/**
 * @typedef {object} EventData
 * @property {boolean} once
 * @property {boolean} enabled
 */

export class BaseEvent {
	/**
	 * @param {{ emitter: import('../LunarClient').LunarClient, name: string }} param0
	 * @param {EventData} param1
	 */
	constructor({ emitter, name }, { once, enabled }) {
		this.emitter = emitter;
		this.name = name;

		this.once = once ?? false;
		this.enabled = enabled ?? true;

		this.callback = this.run.bind(this);
	}

	/**
	 * client config
	 * @returns {import('../database/managers/ConfigManager')}
	 */
	get config() {
		return this.client.config;
	}

	/**
	 * add the event listener
	 * @param {boolean} [force=false] wether to also load disabled events
	 */
	load(force = false) {
		if (this.enabled || force) this.emitter[this.once ? 'once' : 'on'](this.name, this.callback);
	}

	/**
	 * remove the event listener
	 */
	unload() {
		this.emitter.off(this.name, this.callback);
	}

	/**
	 * event listener callback
	 */
	async run() {
		throw new Error('no run function specified');
	}
}
