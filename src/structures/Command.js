'use strict';

const ConfigCollection = require('./collections/ConfigCollection');
const LunarMessage = require('./extensions/Message');
const LunarClient = require('./LunarClient');


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
		this.usage = info.usage;
		this.cooldown = info.cooldown ?? null;
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
	 * @returns {?string[]}
	 */
	get requiredRoles() {
		switch (this.category) {
			case 'staff':
				return [ this.client.config.get('TRIAL_MODERATOR_ROLE_ID'), this.client.config.get('MODERATOR_ROLE_ID'), this.client.config.get('SENIOR_STAFF_ROLE_ID'), this.client.config.get('MANAGER_ROLE_ID') ];

			case 'manager':
				return [ this.client.config.get('MANAGER_ROLE_ID') ];

			default:
				if (this.client.config.getBoolean('GUILD_PLAYER_ONLY_MODE')) return [ this.client.config.get('GUILD_ROLE_ID') ];
				return null;
		}
	}

	/**
	 * execute the command
	 * @param {LunarClient} client
	 * @param {ConfigCollection} config
	 * @param {LunarMessage} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	run(client, config, message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		throw new Error('no run function specified');
	}
}

module.exports = Command;
