import { SlashCommandBuilder } from 'discord.js';
import { InteractionUtil } from '#utils';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import { exitProcess } from '#root/process';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class StopCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('stop the bot. It should restart immediatly'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		await InteractionUtil.reply(interaction, 'stopping the bot');
		void exitProcess();
	}
}
