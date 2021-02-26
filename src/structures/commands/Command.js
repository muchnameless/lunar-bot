'use strict';

/**
 * @typedef {object} CommandInfo additional information about the command
 * @property {string[]} [aliases] command aliases
 * @property {string} [description] command description
 * @property {boolean} [guildOnly] wether this command can only be executed on servers
 * @property {boolean} [args] wether arguments are required or not
 * @property {string|Function} [usage] argument usage
 * @property {number} [cooldown] command cooldown
 */


class Command {
	/**
	 * create a new command
	 * @param {object} param0
	 * @param {import('../LunarClient')} param0.client discord client that instantiated this command
	 * @param {string} param0.name the name of the command
	 * @param {string} param0.category the category of the command
	 * @param {CommandInfo} param1
	 */
	constructor({ client, name, category }, { aliases, description, guildOnly, args, usage, cooldown }) {
		this.client = client;
		this.name = name;
		this.category = category;

		this.aliases = aliases?.length ? aliases : null;
		this.description = description?.length ? description : null;
		this.guildOnly = guildOnly ?? false;
		this.args = args ?? false;
		this.usage = usage;
		this.cooldown = cooldown ?? null;
	}

	/**
	 * @param {string|Function} value
	 */
	set usage(value) {
		this._usage = typeof value === 'function' || value?.length
			? value
			: null;
	}

	/**
	 * @returns {string} command argument usage
	 */
	get usage() {
		return typeof this._usage === 'function'
			? this._usage()
			: this._usage;
	}

	/**
	 * prefix name usage
	 */
	get usageInfo() {
		return `\`${this.client.config.get('PREFIX')}${this.aliases?.[0].length < this.name ? this.aliases[0] : this.name}\` ${this.usage}`;
	}

	/**
	 * @returns {?string[]}
	 */
	get requiredRoles() {
		switch (this.category) {
			case 'staff':
				return [ this.client.config.get('SHRUG_ROLE_ID'), this.client.config.get('TRIAL_MODERATOR_ROLE_ID'), this.client.config.get('MODERATOR_ROLE_ID'), this.client.config.get('SENIOR_STAFF_ROLE_ID'), this.client.config.get('MANAGER_ROLE_ID') ];

			case 'manager':
				return [ this.client.config.get('MANAGER_ROLE_ID') ];

			default:
				return null;
		}
	}

	/**
	 * wether the command is part of a visible category
	 */
	get visible() {
		return !this.client.commands.invisibleCategories.includes(this.category);
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	load() {
		this.client.commands.set(this.name.toLowerCase(), this);
		this.aliases?.forEach(alias => this.client.commands.aliases.set(alias.toLowerCase(), this.name.toLowerCase()));
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	unload() {
		this.aliases?.forEach(alias => this.client.commands.aliases.delete(alias.toLowerCase()));
		this.client.commands.delete(this.name.toLowerCase());
	}

	/**
	 * execute the command
	 * @param {import('../LunarClient')} client
	 * @param {import('../database/ConfigHandler')} config
	 * @param {import('../extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		throw new Error('no run function specified');
	}
}

module.exports = Command;
