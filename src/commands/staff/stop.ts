import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionUtil } from '../../util';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class StopCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('stop the bot. It should restart immediatly'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		await InteractionUtil.reply(interaction, 'stopping the bot');
		this.client.exit();
	}
}
