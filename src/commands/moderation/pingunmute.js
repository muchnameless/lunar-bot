import { SlashCommandBuilder } from '@discordjs/builders';
import { requiredPlayerOption } from '../../structures/commands/commonOptions.js';
// import { InteractionUtil } from '../../util/InteractionUtil.js';
import PingMute from './pingmute.js';
import { logger } from '../../functions/logger.js';


export default class PingUnmuteCommand extends PingMute {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('allow a guild member to @mention via the chat bridge')
				.addStringOption(requiredPlayerOption),
			cooldown: 0,
		});
	}

	/**
	 * @param {?import('../../structures/database/models/Player').Player} player
	 * @param {string} playerInput
	 */
	async _generateReply(player, playerInput) {
		if (!player) return `\`${playerInput}\` is not in the player db`;

		if (player.hasDiscordPingPermission) return `\`${player}\` is not ping muted`;

		try {
			player.hasDiscordPingPermission = true;
			await player.save();

			return `\`${player}\` can now ping members via the chat bridge`;
		} catch (error) {
			logger.error(error);
			return `an error occurred while trying to give \`${player}\` ping permissions`;
		}
	}
}
