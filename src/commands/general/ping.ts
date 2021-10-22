import { SlashCommandBuilder } from '@discordjs/builders';
import { oneLine } from 'common-tags';
import { InteractionUtil } from '../../util';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import { seconds } from '../../functions';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class PingCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
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
			rejectOnError: true,
		});

		return InteractionUtil.reply(interaction, oneLine`
			Roundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp} ms |
			Average WebSocket Heartbeat: ${this.client.ws.ping} ms
		`);
	}
}
