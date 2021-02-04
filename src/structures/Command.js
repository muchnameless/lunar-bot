'use strict';

class Command {
	/**
	 * create a new command
	 * @param {Client} client discord client that instantiated this command
	 * @param {string} name the name of the command
	 * @param {string} category the category of the command
	 * @param {object} info additional information about the command
	 * @param {string[]} [info.aliases] command aliases
	 * @param {string} [info.description] command description
	 * @param {boolean} [info.guildOnly] wether this command can only be executed on servers
	 * @param {boolean} [info.args] wether arguments are required or not
	 * @param {string|Function} [info.usage] argument usage
	 * @param {number} [info.cooldown] command cooldown
	 */
	constructor({ client, name, category }, info) {
		this.client = client;
		this.name = name;
		this.category = category;

		this.aliases = info.aliases?.length ? info.aliases : null;
		this.description = info.description?.length ? info.description : null;
		this.guildOnly = info.guildOnly ?? false;
		this.args = info.args ?? false;
		this._usage = info.usage?.length ? info.usage : null;
		this.cooldown = info.cooldown ?? null;
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
	 * 
	 * @param {Message} message 
	 * @param {string[]} args 
	 * @param {string[]} flags 
	 * @param {string[]} rawArgs 
	 */
	run(client, config, message, args, flags, rawArgs) {
		throw new Error('no run function specified');
	}
}

module.exports = Command;
