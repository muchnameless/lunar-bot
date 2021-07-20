'use strict';

const BaseCommand = require('./BaseCommand');

/**
 * @typedef {object} CommandInfo additional information about the command
 * @property {string[]} [aliases] command aliases
 * @property {string} [description] command description
 * @property {boolean} [guildOnly] wether this command can only be executed on servers
 * @property {number|boolean} [args] wether arguments are required or not (or the number of required arguments)
 * @property {string|Function} [usage] argument usage
 * @property {number} [cooldown] command cooldown
 */


module.exports = class BridgeCommand extends BaseCommand {
	/**
	 * create a new command
	 * @param {BaseCommand.BaseCommandData} param0
	 * @param {CommandInfo} param1
	 */
	constructor(param0, { aliases, description, guildOnly, args, usage, cooldown, requiredRoles }) {
		super(param0, { cooldown, requiredRoles });

		this._usage = null;

		this.aliases = aliases?.length
			? aliases.filter(Boolean)
			: null;
		this.description = description?.length ? description : null;
		this.guildOnly = guildOnly ?? false;
		this.args = args ?? false;
		this.usage = usage;
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
		return `\`${this.config.get('PREFIXES')[0]}${this.aliases?.[0].length < this.name ? this.aliases[0] : this.name}\` ${this.usage}`;
	}

	/**
	 * wether the command is part of a visible category
	 */
	get visible() {
		return !this.collection.constructor.INVISIBLE_CATEGORIES.includes(this.category);
	}

	/**
	 * checks wether the array includes 'f' or 'force'
	 * @returns {string[]} array
	 */
	get force() {
		return this.collection.constructor.force;
	}

	/**
	 * execute the command
	 * @param {import('../extensions/Message')} message message that triggered the command
	 */
	async runInGame(message) { // eslint-disable-line no-unused-vars
		throw new Error('no run function specified');
	}
};
