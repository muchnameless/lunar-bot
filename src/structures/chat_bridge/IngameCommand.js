'use strict';

const Command = require('../commands/Command');
const logger = require('../../functions/logger');


class IngameCommand extends Command {
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
