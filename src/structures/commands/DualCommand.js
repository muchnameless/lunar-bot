'use strict';

const SlashCommand = require('./SlashCommand');


module.exports = class DualCommand extends SlashCommand {
	/**
	 * create a new command
	 * @param {object} param0
	 * @param {import('../LunarClient')} param0.client discord this.client that instantiated this command
	 * @param {import('./BridgeCommandCollection')} param0.collection
	 * @param {string} param0.name command name
	 * @param {SlashCommand.CommandData} param1
	 * @param {import('./BridgeCommand').CommandInfo} param2
	 */
	constructor(param0, param1, { aliases, guildOnly, args, usage }) {
		super(param0, param1);

		const { name, description } = this;

		this.inGameData = {
			name,
			aliases: aliases?.length ? aliases.filter(Boolean) : null,
			description,
			guildOnly: guildOnly ?? false,
			args: args ?? false,
			_usage: typeof value === 'function' || usage?.length
				? usage
				: null,
			/**
			 * @returns {string} command argument usage
			 */
			get usage() {
				return typeof this._usage === 'function'
					? this._usage()
					: this._usage;
			},
			/**
			 * prefix name usage
			 */
			get usageInfo() {
				return `\`${this.config.get('PREFIX')}${this.aliases?.[0].length < this.name ? this.aliases[0] : this.name}\` ${this.usage}`;
			},
		};
	}

	/**
	 * loads the command and possible aliases into their collections
	 */
	load() {
		// load into slash commands collection
		super.load();

		// load into chatbridge command collection
		this.client.chatBridges.commands.set(this.name.toLowerCase(), this);
		this.inGameData.aliases?.forEach(alias => this.client.chatBridges.commands.set(alias.toLowerCase(), this));
	}

	/**
	 * removes all aliases and the command from the commandsCollection
	 */
	unload() {
		// unload from slash commands collection
		super.unload();

		// unload from chatbridge command collection
		this.client.chatBridges.commands.delete(this.name.toLowerCase());
		this.inGameData.aliases?.forEach(alias => this.client.chatBridges.commands.delete(alias.toLowerCase()));
	}

	/**
	 * execute the command
	 * @param {import('../chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		throw new Error('no run function specified');
	}
};
