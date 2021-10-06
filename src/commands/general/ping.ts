import { SlashCommandBuilder } from '@discordjs/builders';
import { oneLine } from 'common-tags';
import { InteractionUtil } from '../../util';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import { seconds } from '../../functions';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class PingCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('check API latency and WebSocket ping'),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const sent = await InteractionUtil.deferReply(interaction, {
			fetchReply: true,
		});

		if (sent) return InteractionUtil.reply(interaction, oneLine`
			Roundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp} ms |
			Average WebSocket Heartbeat: ${this.client.ws.ping} ms
		`);
	}
}
