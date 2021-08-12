'use strict';

const { getUuidAndIgn } = require('../../functions/input');
const hypixel = require('../../api/hypixel');
const DualCommand = require('../../structures/commands/DualCommand');
const logger = require('../../functions/logger');

/**
 * @typedef {object} FetchedData
 * @property {string} ign
 * @property {import('@zikeji/hypixel').Components.Schemas.Player} playerData
 */


module.exports = class StatsCommand extends DualCommand {
	/**
	 * @param {import('discord.js').CommandInteraction | import('../../structures/chat_bridge/HypixelMessage')} ctx
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
	async run(interaction) {
		this.deferReply(interaction);

		try {
			return this.reply(interaction, 
				this._generateReply(
					await this._fetchData(interaction, interaction.options.getString('ign')),
				),
			);
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]: ${error}`);
			return await this.reply(interaction, `${error}`);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message
	 */
	async runInGame(message) {
		try {
			return message.reply(
				this._generateReply(
					await this._fetchData(message, ...message.commandData.args),
				),
			);
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]: ${error}`);
			return await message.reply(`${error}`);
		}
	}
};
