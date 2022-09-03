import { SlashCommandBuilder } from 'discord.js';
import PingMute from './pingmute.js';
import { logger } from '#logger';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { requiredPlayerOption } from '#structures/commands/commonOptions.js';
import { type Player } from '#structures/database/models/Player.js';

export default class PingUnmuteCommand extends PingMute {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('allow a guild member to @mention via the chat bridge')
				.addStringOption(requiredPlayerOption),
		});
	}

	/**
	 * @param player
	 * @param playerInput
	 */
	protected override async _generateReply(player: Player | null, playerInput: string) {
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
