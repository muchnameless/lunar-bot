import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionUtil } from '../../util';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class UnloadCommand extends DualCommand {
	constructor(context: CommandContext) {
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
	 * @param subcommand
	 * @param input
	 */
	#run(subcommand: string, input: string) {
		switch (subcommand) {
			case 'command': {
				const command = this.collection.getByName(input);
				if (!command) return `no command with the name or alias \`${input}\` found`;

				command.unload();

				return `command \`${command.name}\` was unloaded successfully`;
			}

			case 'event': {
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
	 * @param interaction
	 */
	override runSlash(interaction: CommandInteraction) {
		return InteractionUtil.reply(interaction, this.#run(interaction.options.getSubcommand(), interaction.options.getString('name', true)));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override  runMinecraft(hypixelMessage: HypixelMessage<true>) {
		return hypixelMessage.reply(this.#run(...hypixelMessage.commandData!.args.map(arg => arg.toLowerCase())));
	}
}
