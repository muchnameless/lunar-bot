import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionUtil } from '../../util/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';


export default class StopCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('stop the bot. It should restart immediatly'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		await InteractionUtil.reply(interaction, 'stopping the bot');
		this.client.exit();
	}
}
