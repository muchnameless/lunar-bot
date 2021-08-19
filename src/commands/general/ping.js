import { SlashCommandBuilder } from '@discordjs/builders';
import { oneLine } from 'common-tags';
import ms from 'ms';
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
		const sent = await InteractionUtil.reply(interaction, {
			content: 'Pinging...',
			fetchReply: true,
		});

		return await InteractionUtil.editReply(interaction, oneLine`
			Roundtrip latency: ${ms(sent.createdTimestamp - interaction.createdTimestamp, { long: true })} |
			Average WebSocket Heartbeat: ${ms(Math.round(this.client.ws.ping), { long: true })}
		`);
	}
}
