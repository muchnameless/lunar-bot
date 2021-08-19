import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionUtil } from '../../util/index.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';


export default class UnloadCommand extends DualCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('unload a command or an event')
				.addSubcommand(subcommand => subcommand
					.setName('command')
					.setDescription('unload a command')
					.addStringOption(option => option
						.setName('name')
						.setDescription('command name')
						.setRequired(true),
					),
				)
				.addSubcommand(subcommand => subcommand
					.setName('event')
					.setDescription('unload an event')
					.addStringOption(option => option
						.setName('name')
						.setDescription('event name')
						.setRequired(true),
					),
				),
			cooldown: 0,
		}, {
			aliases: [],
			args: true,
			usage: '[`command` [command `name`]|`event` [event `name`]]',
		});
	}

	/**
	 * execute the command
	 * @param {string} subcommand
	 * @param {string} input
	 */
	async #run(subcommand, input) {
		switch (subcommand) {
			case 'command': {
				/** @type {import('../../structures/commands/BaseCommand').BaseCommand} */
				const command = this.collection.getByName(input);

				if (!command) return `no command with the name or alias \`${input}\` found`;

				command.unload();

				return `command \`${command.name}\` was unloaded successfully`;
			}

			case 'event': {
				/** @type {import('../../structures/events/BaseEvent').BaseEvent} */
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
	async runSlash(interaction) {
		return await InteractionUtil.reply(interaction, await this.#run(interaction.options.getSubcommand(), interaction.options.getString('name', true)));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		return await hypixelMessage.reply(await this.#run(...hypixelMessage.commandData.args.map(arg => arg.toLowerCase())));
	}
}
