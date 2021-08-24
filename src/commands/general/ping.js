import { SlashCommandBuilder } from '@discordjs/builders';
import { oneLine } from 'common-tags';
import { InteractionUtil } from '../../util/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';


export default class PingCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('check API latency and WebSocket ping'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		const sent = await InteractionUtil.deferReply(interaction, {
			fetchReply: true,
		});

		if (!sent) return;

		return await InteractionUtil.reply(interaction, oneLine`
			Roundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp} ms |
			Average WebSocket Heartbeat: ${this.client.ws.ping} ms
		`);
	}
}
