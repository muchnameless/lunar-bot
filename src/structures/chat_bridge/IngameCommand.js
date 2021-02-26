'use strict';

const BaseCommand = require('../commands/BaseCommand');


class IngameCommand extends BaseCommand {
	/**
	 * create a new command
	 * @param {object} param0
	 * @param {import('./ChatBridge')} param0.chatBridge chatBridge that instantiated this command
	 * @param {string} param0.name the name of the command
	 * @param {string} param0.category the category of the command
	 * @param {import('../commands/Command').CommandInfo} info
	 */
	constructor({ chatBridge, name, category }, info) {
		super({ client: chatBridge.client, name, category }, info);

		this.chatBridge = chatBridge;
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

	/**
	 * execute the command
	 * @param {import('./ChatBridge')} chatBridge
	 * @param {import('../LunarClient')} client
	 * @param {import('../database/ConfigHandler')} config
	 * @param {import('../extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(chatBridge, client, config, message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		throw new Error('no run function specified');
	}
}

module.exports = IngameCommand;
