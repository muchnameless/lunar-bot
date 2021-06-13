'use strict';

const { Constants } = require('discord.js');
const DualCommand = require('../../structures/commands/DualCommand');
// const logger = require('../../functions/logger');


module.exports = class UnloadCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'unload a command',
				options: [{
					name: 'name',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'command name',
					required: true,
				}],
				defaultPermission: true,
				cooldown: 0,
			},
			{
				aliases: [],
				args: true,
				usage: '[`command name` to unload]',
			},
		);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 */
	async _run(ctx, commandName) {
		/** @type {import('../../structures/commands/BaseCommand')} */
		const command = this.collection.getByName(commandName);

		if (!command) return ctx.reply(`no command with the name or alias \`${commandName}\` found`);

		command.unload();

		return ctx.reply(`command \`${command.name}\` was unloaded successfully`);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		return this._run(interaction, interaction.options.get('name')?.value.toLowerCase());
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		return this._run(message, args[0].toLowerCase());
	}
};
