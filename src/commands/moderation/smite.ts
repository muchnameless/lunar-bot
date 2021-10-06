import { SlashCommandBuilder } from '@discordjs/builders';
import { targetOption, buildGuildOption } from '../../structures/commands/commonOptions';
import { minutes } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';
import type GuildCommand from '../guild/guild';


export default class SmiteCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('guild mute for 10 minutes')
				.addStringOption(targetOption)
				.addStringOption(buildGuildOption(context.client)),
			cooldown: 0,
		}, {
			aliases: [],
			args: 1,
			usage: '[`IGN`]',
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override runSlash(interaction: CommandInteraction) {
		const guildCommand = this.client.commands.get('guild') as GuildCommand;

		return guildCommand.runMuteInteraction(interaction, minutes(10));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelMessage<true>) {
		const guildCommand = this.client.commands.get('guild') as GuildCommand;
		const TARGET_INPUT = hypixelMessage.commandData.args[0].toLowerCase();
		const target = await guildCommand.getMuteTarget(TARGET_INPUT);

		if (!target) return hypixelMessage.author.send(`no player with the IGN \`${TARGET_INPUT}\` found`);

		const { content } = await guildCommand.runMute({
			target,
			executor: hypixelMessage.player,
			duration: minutes(10),
			hypixelGuild: hypixelMessage.hypixelGuild ?? hypixelMessage.player!.hypixelGuild!,
		});

		return hypixelMessage.author.send(content);
	}
}
