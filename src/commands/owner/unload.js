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
	 * @param {string} subcommand
	 * @param {string} input
	 */
	async _run(ctx, subcommand, input) {
		switch (subcommand) {
			case 'command': {
				/** @type {import('../../structures/commands/BaseCommand')} */
				const command = this.collection.getByName(input);

				if (!command) return ctx.reply(`no command with the name or alias \`${input}\` found`);

				command.unload();

				return ctx.reply(`command \`${command.name}\` was unloaded successfully`);
			}

			case 'event': {
				/** @type {import('../../structures/commands/BaseCommand')} */
				const event = this.client.events.get(input);

				if (!event) return ctx.reply(`no event with the name \`${input}\` found`);

				event.unload();

				return ctx.reply(`event \`${event.name}\` was unloaded successfully`);
			}

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		return this._run(interaction, interaction.options.getSubcommand(), interaction.options.getString('name', true));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message
	 */
	async runInGame(message) {
		return this._run(message, ...message.commandData.args.map(arg => arg.toLowerCase()));
	}
};
