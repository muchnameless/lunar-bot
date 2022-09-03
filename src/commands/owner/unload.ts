import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';
import { InteractionUtil } from '#utils';

export default class UnloadCommand extends DualCommand {
	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription('unload a command or an event')
					.addSubcommand((subcommand) =>
						subcommand
							.setName('command')
							.setDescription('unload a command')
							.addStringOption((option) =>
								option //
									.setName('name')
									.setDescription('command name')
									.setRequired(true),
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('event')
							.setDescription('unload an event')
							.addStringOption((option) =>
								option //
									.setName('name')
									.setDescription('event name')
									.setRequired(true),
							),
					),
				cooldown: 0,
			},
			{
				args: true,
				usage: '[`command` [command `name`]|`event` [event `name`]]',
			},
		);
	}

	/**
	 * execute the command
	 *
	 * @param subcommand
	 * @param input
	 */
	private _sharedRun(subcommand: string, input: string) {
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
	 *
	 * @param interaction
	 */
	public override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(
			interaction,
			this._sharedRun(interaction.options.getSubcommand(), interaction.options.getString('name', true)),
		);
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(
			this._sharedRun(...(hypixelMessage.commandData.args.map((arg) => arg.toLowerCase()) as [string, string])),
		);
	}
}
