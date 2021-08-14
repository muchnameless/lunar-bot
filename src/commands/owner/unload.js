import { Constants } from 'discord.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
// import { logger } from '../../functions/logger.js';


export default class UnloadCommand extends DualCommand {
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
	 * @param {string} subcommand
	 * @param {string} input
	 */
	async #run(subcommand, input) {
		switch (subcommand) {
			case 'command': {
				/** @type {import('../../structures/commands/BaseCommand')} */
				const command = this.collection.getByName(input);

				if (!command) return `no command with the name or alias \`${input}\` found`;

				command.unload();

				return `command \`${command.name}\` was unloaded successfully`;
			}

			case 'event': {
				/** @type {import('../../structures/commands/BaseCommand')} */
				const event = this.client.events.get(input);

				if (!event) return `no event with the name \`${input}\` found`;

				event.unload();

				return `event \`${event.name}\` was unloaded successfully`;
			}

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		return await this.reply(interaction, await this.#run(interaction, interaction.options.getSubcommand(), interaction.options.getString('name', true)));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} message
	 */
	async runInGame(message) {
		return await message.reply(await this.#run(message, ...message.commandData.args.map(arg => arg.toLowerCase())));
	}
}
