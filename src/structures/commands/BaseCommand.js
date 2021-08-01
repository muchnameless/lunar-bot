'use strict';

const { Collection } = require('discord.js');

/**
 * @typedef {object} BaseCommandData additional information about the command
 * @property {import('../LunarClient')} client discord this.client that instantiated this command
 * @property {import('./BaseCommandCollection')} collection
 * @property {string} name the name of the command
 * @property {string} category the category of the command
 */


module.exports = class BaseCommand {
	/**
	 * create a new command
	 * @param {BaseCommandData} param0
	 * @param {{ cooldown?: number, requiredRoles: () => import('discord.js').Snowflake[] }} param1
	 */
	constructor({ client, collection, name, category }, { cooldown, requiredRoles }) {
		this.client = client;
		this.collection = collection;
		this.name = name;
		this.category = category;

		this.cooldown = cooldown ?? null;
		/** @type {() => import('discord.js').Snowflake[]} */
		this._requiredRoles = requiredRoles ?? null;
		/** @type {Collection<import('discord.js').Snowflake, number>} */
		this.timestamps = this.cooldown !== 0
			? new Collection()
			: null;
	}

	/**
	 * client config
	 */
	get config() {
		return this.client.config;
	}

	/**
	 * roles required to run this command
	 */
	get requiredRoles() {
		if (this._requiredRoles) return this._requiredRoles();

		switch (this.category) {
			case 'staff':
			case 'moderation':
				return [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('DANKER_STAFF_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ];

			case 'tax':
			case 'manager':
				return [ this.config.get('MANAGER_ROLE_ID') ];

			case 'guild':
				return null;

			default:
				return null;
		}
	}

	/**
	 * clears the cooldown timestamps collection
	 */
	clearCooldowns() {
		if (this.timestamps) this.timestamps = new Collection();
		return this;
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	load() {
		this.collection.set(this.name.toLowerCase(), this);
		this.aliases?.forEach(alias => this.collection.set(alias.toLowerCase(), this));
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	unload() {
		this.collection.delete(this.name.toLowerCase());
		this.aliases?.forEach(alias => this.collection.delete(alias.toLowerCase()));
	}

	/**
	 * execute the command
	 */
	async run() {
		throw new Error('no run function specified');
	}
};
