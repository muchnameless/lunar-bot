import { SlashCommandBuilder } from 'discord.js';
import { hypixelGuildOption, targetOption } from '../../structures/commands/commonOptions';
import { minutes } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import { InteractionUtil } from '../../util';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type GuildCommand from '../guild/guild';

export default class SmiteCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription('guild mute for 10 minutes')
					.addStringOption(targetOption)
					.addStringOption(hypixelGuildOption),
				cooldown: 0,
			},
			{
				args: 1,
				usage: '[`IGN`]',
			},
		);
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const guildCommand = this.client.commands.get('guild') as GuildCommand;

		return guildCommand.runMuteInteraction(interaction, hypixelGuild, minutes(10));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		const guildCommand = this.client.commands.get('guild') as GuildCommand;
		const TARGET_INPUT = hypixelMessage.commandData.args[0]!.toLowerCase();
		const target = await guildCommand.getMuteTarget(TARGET_INPUT);

		if (!target) return hypixelMessage.author.send(`no player with the IGN \`${TARGET_INPUT}\` found`);

		const hypixelGuild = hypixelMessage.hypixelGuild ?? hypixelMessage.player?.hypixelGuild;

		if (!hypixelGuild) return hypixelMessage.author.send('unable to find your hypixel guild');

		const content = await guildCommand.runMute({
			target,
			executor: hypixelMessage.player,
			duration: minutes(10),
			hypixelGuild,
		});

		return hypixelMessage.author.send(content);
	}
}
