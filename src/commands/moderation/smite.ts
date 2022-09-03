import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type GuildCommand from '../guild/guild.js';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { minutes } from '#functions';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';
import { hypixelGuildOption, targetOption } from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

export default class SmiteCommand extends DualCommand {
	public constructor(context: CommandContext) {
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
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const guildCommand = this.client.commands.get('guild') as GuildCommand;

		return guildCommand.runMuteInteraction(interaction, hypixelGuild, minutes(10));
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
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
