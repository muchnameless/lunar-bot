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
					name: 'command',
					type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'unload a command',
					options: [{
						name: 'name',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'command name',
						required: true,
					}],
				}, {
					name: 'event',
					type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'unload an event',
					options: [{
						name: 'name',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'event name',
						required: true,
					}],
				}],
				defaultPermission: true,
				cooldown: 0,
			},
			{
				aliases: [],
				args: true,
				usage: '[`command` [command `name`]|`event` [event `name`]]',
			},
		);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {string} mode
	 * @param {string} name
	 */
	async _run(ctx, mode, name) {
		switch (mode) {
			case 'command': {
				/** @type {import('../../structures/commands/BaseCommand')} */
				const command = this.collection.getByName(name);

				if (!command) return ctx.reply(`no command with the name or alias \`${name}\` found`);

				command.unload();

				return ctx.reply(`command \`${command.name}\` was unloaded successfully`);
			}

			case 'event': {
				/** @type {import('../../structures/commands/BaseCommand')} */
				const event = this.client.events.get(name);

				if (!event) return ctx.reply(`no event with the name \`${name}\` found`);

				event.unload();

				return ctx.reply(`event \`${event.name}\` was unloaded successfully`);
			}

			default:
				throw new Error(`unknown subcommand '${mode}'`);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		const { name, options } = interaction.options.first();

		return this._run(interaction, name, options.first().value);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		return this._run(message, ...args.map(arg => arg.toLowerCase()));
	}
};
