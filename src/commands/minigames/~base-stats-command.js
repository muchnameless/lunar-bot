import { hypixel } from '../../api/hypixel.js';
import { InteractionUtil } from '../../util/index.js';
import { getUuidAndIgn, logger } from '../../functions/index.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';

/**
 * @typedef {object} FetchedData
 * @property {string} ign
 * @property {import('@zikeji/hypixel').Components.Schemas.Player} playerData
 */


export default class StatsCommand extends DualCommand {
	/**
	 * @param {import('discord.js').CommandInteraction | import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} ctx
	 * @param {string} [ignOrUuid]
	 * @returns {Promise<FetchedData>}
	 */
	async _fetchData(ctx, ignOrUuid) { // eslint-disable-line class-methods-use-this
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);

		return {
			ign,
			playerData: await hypixel.player.uuid(uuid),
		};
	}

	/**
	 * @param {number} kills
	 * @param {number} deaths
	 * @returns {?string}
	 */
	calculateKD(kills, deaths) {
		if (kills == null || deaths == null) return null;
		return this.client.formatDecimalNumber(Math.floor((kills / Math.max(deaths, 1)) * 100) / 100);
	}

	/**
	 * data -> reply
	 * @param {FetchedData}
	 */
	_generateReply({ ign }) {
		return ign;
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		try {
			return await InteractionUtil.reply(interaction,
				this._generateReply(
					await this._fetchData(interaction, interaction.options.getString('ign')),
				),
			);
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]: ${error}`);
			return await InteractionUtil.reply(interaction, `${error}`);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		try {
			return hypixelMessage.reply(
				this._generateReply(
					await this._fetchData(hypixelMessage, ...hypixelMessage.commandData.args),
				),
			);
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]: ${error}`);
			return await hypixelMessage.reply(`${error}`);
		}
	}
}
