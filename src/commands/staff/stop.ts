import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionUtil } from '../../util';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

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
	override async runSlash(interaction: ChatInputCommandInteraction) {
		await InteractionUtil.reply(interaction, 'stopping the bot');
		this.client.exit();
	}
}
