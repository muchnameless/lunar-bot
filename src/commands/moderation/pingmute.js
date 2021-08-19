import { SlashCommandBuilder } from '@discordjs/builders';
import { requiredPlayerOption } from '../../structures/commands/commonOptions.js';
import { InteractionUtil } from '../../util/index.js';
import { logger } from '../../functions/index.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';


export default class PingMuteCommand extends DualCommand {
	constructor(context, param1, param2) {
		super(context,
			param1 ?? {
				aliases: [],
				slash: new SlashCommandBuilder()
					.setDescription('prevent a guild member from @mentioning via the chat bridge')
					.addStringOption(requiredPlayerOption),
				cooldown: 0,
			},
			param2 ?? {
				aliases: [],
				args: 1,
				usage: '[`IGN`|`UUID`|`discord ID`|`@mention`]',
			},
		);
	}

	/**
	 * @param {?import('../../structures/database/models/Player').Player} player
	 * @param {string} playerInput
	 */
	async _generateReply(player, playerInput) {
		if (!player) return `\`${playerInput}\` is not in the player db`;

		if (!player.hasDiscordPingPermission) return `\`${player}\` is already ping muted`;

		try {
			player.hasDiscordPingPermission = false;
			await player.save();

			return `\`${player}\` can no longer ping members via the chat bridge`;
		} catch (error) {
			logger.error(error);
			return `an error occurred while trying to remove \`${player}\`'s ping permissions`;
		}
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		return await InteractionUtil.reply(interaction, await this._generateReply(
			InteractionUtil.getPlayer(interaction),
			interaction.options.getString('player', true),
		));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		const [ INPUT ] = hypixelMessage.commandData.args;

		return await hypixelMessage.reply(await this._generateReply(
			this.client.players.getById(INPUT) ?? this.client.players.getByIgn(INPUT),
			INPUT,
		));
	}
}
