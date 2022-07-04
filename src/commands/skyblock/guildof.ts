import { SlashCommandBuilder } from 'discord.js';
import { InteractionUtil } from '#utils';
import { logger } from '#logger';
import { requiredIgnOption } from '#structures/commands/commonOptions';
import { DualCommand } from '#structures/commands/DualCommand';
import { hypixel, mojang } from '#api';
import { escapeIgn, formatError, seconds } from '#functions';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';

export default class GuildOfCommand extends DualCommand {
	constructor(context: CommandContext) {
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
	 * @param ignOrUuid
	 */
	private async _generateReply(ignOrUuid: string) {
		try {
			const { uuid, ign } = await mojang.ignOrUuid(ignOrUuid);
			const { name, tag, members } = await hypixel.guild.player(uuid);

			if (!name) return `${ign}: no guild`;

			return `${escapeIgn(ign)}: ${name}${tag ? ` [${tag}]` : ''} ${members.length}/125 members`;
		} catch (error) {
			logger.error(error, '[GUILDOF CMD]');

			return formatError(error);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(interaction, await this._generateReply(interaction.options.getString('ign', true)));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(await this._generateReply(hypixelMessage.commandData.args.positionals[0]!));
	}
}
