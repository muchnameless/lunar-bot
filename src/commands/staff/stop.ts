import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { exitProcess } from '#root/process.js';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { InteractionUtil } from '#utils';

export default class StopCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('stop the bot. It should restart immediately'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		await InteractionUtil.reply(interaction, 'stopping the bot');
		void exitProcess();
	}
}
