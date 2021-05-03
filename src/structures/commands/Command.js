'use strict';

/**
 * @typedef {object} CommandInfo additional information about the command
 * @property {string[]} [aliases] command aliases
 * @property {string} [description] command description
 * @property {boolean} [guildOnly] wether this command can only be executed on servers
 * @property {number|boolean} [args] wether arguments are required or not (or the number of required arguments)
 * @property {string|Function} [usage] argument usage
 * @property {number} [cooldown] command cooldown
 */


module.exports = class Command {
	/**
	 * create a new command
	 * @param {object} param0
	 * @param {import('../LunarClient')} param0.client discord this.client that instantiated this command
	 * @param {import('./CommandCollection')} param0.commandCollection
	 * @param {string} param0.name the name of the command
	 * @param {string} param0.category the category of the command
	 * @param {CommandInfo} param1
	 */
	constructor({ client, commandCollection, name, category }, { aliases, description, guildOnly, args, usage, cooldown }) {
		this.client = client;
		this.commandCollection = commandCollection;
		this.name = name;
		this.category = category;

		this.aliases = aliases?.length ? aliases.filter(Boolean) : null;
		this.description = description?.length ? description : null;
		this.guildOnly = guildOnly ?? false;
		this.args = args ?? false;
		this.usage = usage;
		this.cooldown = cooldown ?? null;

		this.isBridgeCommand = null;
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
		return `\`${this.config.get('PREFIX')}${this.aliases?.[0].length < this.name ? this.aliases[0] : this.name}\` ${this.usage}`;
	}

	/**
	 * @returns {?string[]}
	 */
	get requiredRoles() {
		switch (this.category) {
			case 'staff':
			case 'moderation':
				return [ this.config.get('SHRUG_ROLE_ID'), this.config.get('TRIAL_MODERATOR_ROLE_ID'), this.config.get('MODERATOR_ROLE_ID'), this.config.get('SENIOR_STAFF_ROLE_ID'), this.config.get('MANAGER_ROLE_ID') ];

			case 'tax':
			case 'manager':
				return [ this.config.get('MANAGER_ROLE_ID') ];

			case 'guild':
				return this.commandCollection.isMainCollection
					? [ this.config.get('GUILD_ROLE_ID') ]
					: null;

			default:
				return null;
		}
	}

	/**
	 * wether the command is part of a visible category
	 */
	get visible() {
		return !this.commandCollection.constructor.INVISIBLE_CATEGORIES.includes(this.category);
	}

	/**
	 * checks wether the array includes 'f' or 'force'
	 * @param {string[]} array
	 */
	get force() {
		return this.commandCollection.constructor.force;
	}

	/**
	 * client config
	 */
	get config() {
		return this.client.config;
	}

	/**
	 * loads the command and possible aliases into their collections
	 * @param {Boolean} [isReload=false]
	 */
	load(isReload = false) {
		this.commandCollection.set(this.name.toLowerCase(), this);
		this.aliases?.forEach(alias => this.commandCollection.set(alias.toLowerCase(), this));

		if (isReload && this.isBridgeCommand) {
			if (this.commandCollection.isMainCollection) {
				if (!this.client.chatBridges.commands.has(this.name)) this.client.chatBridges.commands.loadByName(this.name);
			} else if (!this.client.commands.has(this.name)) {
				this.client.commands.loadByName(this.name);
			}
		}
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	unload() {
		this.aliases?.forEach(alias => this.commandCollection.delete(alias.toLowerCase()));
		this.commandCollection.delete(this.name.toLowerCase());

		if (this.isBridgeCommand) {
			if (this.commandCollection.isMainCollection) {
				this.client.chatBridges.commands.get(this.name)?.unload();
			} else {
				this.client.commands.get(this.name)?.unload();
			}
		}

		for (const path of Object.keys(require.cache).filter(filePath => !filePath.includes('node_modules') && !filePath.includes('functions') && filePath.includes('commands') && filePath.endsWith(`${this.name}.js`))) {
			delete require.cache[path];
		}
	}

	/**
	 * execute the command
	 * @param {import('../extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		throw new Error('no run function specified');
	}
};
