import { SlashCommandBuilder } from 'discord.js';
import { requiredPlayerOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { logger } from '../../logger';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { Player } from '../../structures/database/models/Player';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { ApplicationCommandData } from '../../structures/commands/ApplicationCommand';
import type { BridgeCommandData } from '../../structures/commands/BridgeCommand';

export default class PingMuteCommand extends DualCommand {
	constructor(context: CommandContext, param1?: ApplicationCommandData, param2?: BridgeCommandData) {
		super(
			context,
			param1 ?? {
				slash: new SlashCommandBuilder()
					.setDescription('prevent a guild member from @mentioning via the chat bridge')
					.addStringOption(requiredPlayerOption),
				cooldown: 0,
			},
			param2 ?? {
				args: 1,
				usage: '[`IGN`|`UUID`|`discord ID`|`@mention`]',
			},
		);
	}

	/**
	 * @param player
	 * @param playerInput
	 */
	async _generateReply(player: Player | null, playerInput: string) {
		if (!player) return `\`${playerInput}\` is not in the player db`;

		if (!player.hasDiscordPingPermission) return `\`${player}\` is already ping muted`;

		try {
			await player.update({ hasDiscordPingPermission: false });

			return `\`${player}\` can no longer ping members via the chat bridge`;
		} catch (error) {
			logger.error(error);

			return `an error occurred while trying to remove \`${player}\`'s ping permissions`;
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(
			interaction,
			await this._generateReply(
				InteractionUtil.getPlayer(interaction, { throwIfNotFound: true }),
				interaction.options.getString('player', true),
			),
		);
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		const [INPUT] = hypixelMessage.commandData.args as [string];

		return hypixelMessage.reply(
			await this._generateReply(this.client.players.getById(INPUT) ?? this.client.players.getByIgn(INPUT), INPUT),
		);
	}
}
