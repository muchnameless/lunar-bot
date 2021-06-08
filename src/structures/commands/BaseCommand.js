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
	 * @param {{ cooldown: ?number, requiredRoles: () => import('discord.js').Snowflake[] }} param1
	 */
	constructor({ client, collection, name, category }, { cooldown, requiredRoles }) {
		this.client = client;
		this.collection = collection;
		this.name = name;
		this.category = category;

		this.cooldown = cooldown ?? null;
		/** @type {() => import('discord.js').Snowflake[]} */
		this._requiredRoles = requiredRoles ?? (() => []);
		/** @type {Collection<import('discord.js').Snowflake, number>} */
		this.timestamps = this.cooldown !== null
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
		return this._requiredRoles();
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
