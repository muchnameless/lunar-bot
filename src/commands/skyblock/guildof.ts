import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { hypixel, mojang } from '#api';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { escapeIgn, formatError, seconds } from '#functions';
import { logger } from '#logger';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';
import { requiredIgnOption } from '#structures/commands/commonOptions.js';
import { InteractionUtil } from '#utils';

export default class GuildOfCommand extends DualCommand {
	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's current hypixel guild")
					.addStringOption(requiredIgnOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['guild'],
				args: 1,
				usage: '[`IGN`]',
			},
		);
	}

	/**
	 * execute the command
	 *
	 * @param ignOrUuid
	 */
	private async _generateReply(ignOrUuid: string) {
		try {
			const { uuid, ign } = await mojang.ignOrUuid(ignOrUuid);
			const { guild } = await hypixel.guild.player(uuid);

			if (!guild) return `${ign}: no guild`;

			return `${escapeIgn(ign)}: ${guild.name}${guild.tag ? ` [${guild.tag}]` : ''} ${
				guild.members.length
			}/125 members`;
		} catch (error) {
			logger.error(error, '[GUILD OF CMD]');

			return formatError(error);
		}
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(interaction, await this._generateReply(interaction.options.getString('ign', true)));
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(await this._generateReply(hypixelMessage.commandData.args[0]!));
	}
}
