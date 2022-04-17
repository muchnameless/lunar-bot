import { SlashCommandBuilder } from 'discord.js';
import { requiredPlayerOption } from '../../structures/commands/commonOptions';
import { logger } from '../../logger';
import PingMute from './pingmute';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { Player } from '../../structures/database/models/Player';

export default class PingUnmuteCommand extends PingMute {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('allow a guild member to @mention via the chat bridge')
				.addStringOption(requiredPlayerOption),
			cooldown: 0,
		});
	}

	/**
	 * @param player
	 * @param playerInput
	 */
	override async _generateReply(player: Player | null, playerInput: string) {
		if (!player) return `\`${playerInput}\` is not in the player db`;

		if (player.hasDiscordPingPermission) return `\`${player}\` is not ping muted`;

		try {
			await player.update({ hasDiscordPingPermission: true });

			return `\`${player}\` can now ping members via the chat bridge`;
		} catch (error) {
			logger.error(error);

			return `an error occurred while trying to give \`${player}\` ping permissions`;
		}
	}
}
