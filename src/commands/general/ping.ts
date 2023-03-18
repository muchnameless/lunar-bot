import { oneLine } from 'common-tags';
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { seconds } from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { InteractionUtil } from '#utils';

export default class PingCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('check API latency and WebSocket ping'),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const sent = await InteractionUtil.deferReply(interaction, {
			fetchReply: true,
			rejectOnError: true,
		});

		return InteractionUtil.reply(
			interaction,
			oneLine`
				Roundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp} ms |
				Average WebSocket Heartbeat: ${this.client.ws.ping} ms
			`,
		);
	}
}
