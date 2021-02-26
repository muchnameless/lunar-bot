'use strict';

const Command = require('../commands/Command');
const logger = require('../../functions/logger');


class IngameCommand extends Command {
	/**
	 * prefix name usage
	 */
	get usageInfo() {
		return `${this.client.config.get('PREFIX')}${this.aliases?.[0].length < this.name ? this.aliases[0] : this.name} ${this.usage}`;
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	load() {
		this.client.chatBridges.commands.set(this.name.toLowerCase(), this);
		this.aliases?.forEach(alias => this.client.chatBridges.commands.aliases.set(alias.toLowerCase(), this.name.toLowerCase()));
	}

	/**
	 * removes all aliases, deletes the require.cache and the command from the commandsCollection
	 */
	unload() {
		this.aliases?.forEach(alias => this.client.chatBridges.commands.aliases.delete(alias.toLowerCase()));
		this.client.chatBridges.commands.delete(this.name.toLowerCase());
	}
}

module.exports = IngameCommand;
